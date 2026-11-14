# Drive-time limit (free estimate) and real Back button — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No slot is offered, and no manual booking passes without a warning, when the drive from the previous or next stop exceeds the business's drive-minute limit. The limit is computed with a free straight-line estimate. The Back arrow returns to the previous screen.

**Architecture:** One pure estimate function, `src/lib/geo/drive.ts`, is used by every distance decision: `findSlots`, `tooFarFromDay`, `nearbyDays`, fill-gap and the requests card. A new `businesses.max_drive_minutes` column replaces the use of `max_cluster_miles`. A client `BackButton` uses browser history when the previous screen is in the app, and otherwise falls back to the current href.

**Tech Stack:** Next.js 16.4. Read `node_modules/next/dist/docs/` before writing client navigation. Also React 19.3, postgres.js and Playwright.

**Spec:** `docs/superpowers/specs/2026-11-14-tempo-de-carro-e-voltar-design.md`

## Global Constraints
- **Estimate:** `driveMinutes(straightMiles) = max(5, round(straightMiles × 1.4 ÷ 35 × 60))`. The constants `DETOUR = 1.4`, `AVG_MPH = 35` and `MIN_MINUTES = 5` live in `src/lib/geo/drive.ts` only.
- **Limit:** `businesses.max_drive_minutes int not null default 35`, check 10–90.
- **"Near" (⭐):** at most 10 estimated minutes.
- **No paid API.** `GOOGLE_MAPS_API_KEY` is not used for this rule.
- **Unknown values block:** an unknown neighbor ZIP blocks that slot. Never let a slot through because a value is `null`.
- **Strings:** owner strings go through `t()`/`msg()`, with translations appended to the 19 owner files (lengths equal to `keys.ts`; do not run `owner-assemble.mjs`). Client strings go through `t()` in the 19 message files.
- **Commits:** English, with the session's two attribution lines. Never push to master.

## Review Focus
1. **The first visit of the day.** The previous stop is the van's `start_zip`. If `start_zip` is null, that side passes; it is the only allowed null, because the business never set it. → Task 2 test.
2. **Day of a cancelled visit.** Cancelled and no-show visits must not count as stops (the existing `ACTIVE` list). → Task 2 test.
3. **Two stops far apart with a gap between them.** A slot between them is refused, even though each stop alone is fine for the client. → Task 2 test.
4. **Metric business.** The settings field is in minutes, so no unit conversion applies. The requests warning shows minutes only. → Task 3 assertion.
5. **Back after a hard reload or from a shared link.** There is no in-app history, so Back goes to the fallback and never leaves the app. → Task 4 test.

---

### Task 1: The estimate and the setting

**Files:**
- Create: `src/lib/geo/drive.ts` (pure, no `server-only`), `tests/drive.test.mjs` (run with `npx tsx tests/drive.test.mjs`), `db/migrations/0054_max_drive_minutes.sql`
- Modify:
  - `src/app/(owner)/settings/booking/page.tsx`: the "max miles between stops" field becomes "Maximum drive minutes between clients", min 10, max 90, step 5. The hint is "An estimate without traffic, from the distance between ZIP codes."
  - `src/app/(owner)/settings/actions.ts`: save `max_drive_minutes` and stop saving `max_cluster_miles`.
  - `src/lib/booking.ts`: `PublicBusiness` gains `max_drive_minutes: number`, selected in `getPublicBusiness`.

**Interfaces — Produces:**
- `export function driveMinutes(straightMiles: number): number`
- `export function driveMinutesBetween(points: Map<string, Point | null>, a: string | null | undefined, b: string | null | undefined): number | null`. It wraps `milesIn` from `src/lib/geo/postal.ts` and returns null when either ZIP is unknown.
- `export const NEAR_DRIVE_MINUTES = 10`

Steps:
- [ ] Write `tests/drive.test.mjs` with node `assert`:
  - `driveMinutes(25.3) === 61`
  - `driveMinutes(19.7) === 47`
  - `driveMinutes(8.1) === 19`
  - `driveMinutes(0) === 5`
  - `driveMinutes(1) === 5`

  Run it. Expected: FAIL, module missing.
- [ ] Implement `drive.ts`, then the test passes.
- [ ] Write the migration: `add column if not exists max_drive_minutes int not null default 35 check (max_drive_minutes between 10 and 90)`. Run `npm run db:migrate`.
- [ ] Update the settings page, action and type. Change the existing `tests/e2e/online-booking-settings.mjs` to set the field to 30 and check that the DB has 30. Run it → PASS.
- [ ] Typecheck, lint. Commit: `Drive-time estimate (free) and the max drive minutes setting`.

### Task 2: Slots respect the previous and next stop

**Files:**
- Modify: `src/lib/booking.ts` `findSlots`
  - Remove the "Rule 4" whole-day check.
  - For each candidate start `t`, the previous stop is the latest active `sameDay` visit ending at or before `t`, or `b.start_zip` if there is none.
  - The next stop is the earliest active visit starting at or after `t + length`.
  - Both must satisfy `driveMinutesBetween(points, zip, neighborZip) <= b.max_drive_minutes`. A null result blocks, except when `start_zip` is null (Review Focus 1).
  - Add `b.start_zip` to the `postalPoints` call.
  - `near` and `best` use `NEAR_DRIVE_MINUTES` on the estimate instead of `NEAR_MILES`.
- Test: `tests/e2e/drive-limit.mjs` (new). Seed via SQL on a working day 10+ days ahead for the seed business, after `slice.mjs`. Set the business `start_zip` to 94063.

Steps:
- [ ] Write `drive-limit.mjs`. It calls the booking page's slot data the way `tests/e2e/nearby.mjs` does: read that file and reuse its approach.
  - (a) With a visit 09:00–11:00 at 94063, a 94611 client sees no times that day. A 94402 client sees times that day.
  - (b) Add a second visit 14:00–16:00 at 94611. Remove the first visit's effect by checking a 94402 client: there are no times between 11:00 and 14:00, because the next stop is 94611, about 47 min from 94402. Times before 09:00 are still offered when 94402 to `start_zip` 94063 is within 35.
  - (c) A cancelled visit at 94611 on another day does not block a 94402 client.
  - (d) A visit whose zip is `99999` (unknown) blocks the adjacent slots for any client.

  Run it. Expected: FAIL.
- [ ] Implement. Then run `drive-limit.mjs`, `booking.mjs`, `nearby.mjs` and `fill-gap.mjs`. If an existing test asserted the old whole-day rule, update its expectation to the new rule, and say so in the report. → PASS.
- [ ] Typecheck, lint. Commit: `Booking: a time is offered only within the drive limit of the stops before and after it`.

### Task 3: Owner side uses the same estimate, plus a warning on requests

**Files:**
- Modify:
  - `src/lib/data/appointments.ts` `tooFarFromDay`: keep its signature but return `{ minutes, client, limit }`, using the previous and next stop for the given time if a time is passed. Otherwise use the closest stop. Update its callers in `src/app/(owner)/appointments/new/page.tsx` and `appointments/actions.ts` so the warning reads "About {min} min drive from {client}'s visit (limit {limit} min)".
  - `src/lib/data/appointments.ts` `nearbyDays`: filter on `driveMinutesBetween(...) <= max_drive_minutes`, sort by minutes, and expose `minutes` instead of `miles`. Update the caller's text.
  - `src/lib/data/fill-gap.ts`: the candidate distance becomes estimated minutes; ordering is unchanged otherwise. The page shows "~{min} min".
  - `src/app/(owner)/requests/page.tsx`: for each pending request, compute the estimate to the previous and next active stop that day. If either is over the limit, the card shows the warning "~{min} min drive from the {time} visit ({city})" in the danger style, above Accept/Decline.
- Test: extend `tests/e2e/drive-limit.mjs`.
  - A pending request at 94611 on the day with the 94063 visit shows the warning containing "61 min".
  - A request at 94402 shows no warning.
  - On a business with `country = 'BR'` (metric), the warning still says "min" (Review Focus 4). Reuse a seeded BR business if one exists, otherwise update the seed business country inside the test and restore it after.

Steps:
- [ ] Add the assertions → FAIL. Implement → PASS. Re-run `fill-gap.mjs`, `nearby.mjs` and `waitlist.mjs`. Typecheck, lint, owner translations. Commit: `Owner app: one drive-time estimate everywhere, and a warning on far booking requests`.

### Task 4: Back returns to the previous screen

**Files:**
- Create: `src/components/back-button.tsx` (`"use client"`).
- Modify: `src/components/ui.tsx` `PageHeader` renders `<BackButton fallback={back} />` instead of the `<Link>` when `back` is set. Same look, same aria-label.
- Modify: the owner layout (`src/app/(owner)/layout.tsx`) mounts `<NavDepth />`, a tiny client component exported from `back-button.tsx`. On every pathname change after the first render, it does `sessionStorage['fino:navDepth'] += 1`. Wrap every sessionStorage access in try/catch.

**Interfaces — Produces:** `export function BackButton({ fallback }: { fallback: string })`. Clicking it calls `router.back()` when `fino:navDepth > 0` (and decrements it). Otherwise it calls `router.push(fallback)`.

- Test: `tests/e2e/back.mjs` (new).
  - Login, open `/settings`, click the menu "Booking requests" → `/requests`, click Back → URL is `/settings`.
  - From `/clients/<id>` → edit → Back → `/clients/<id>`.
  - Open `/requests` directly in a fresh context, click Back → `/today`, the fallback, and still inside the app (Review Focus 5).

Steps:
- [ ] Write `back.mjs` → FAIL (the first assertion lands on `/today`). Implement → PASS. Run `a11y.mjs` (the button keeps its label) and `slice.mjs`. Typecheck, lint. Commit: `Back arrow goes to the previous screen, with the old link as fallback`.
