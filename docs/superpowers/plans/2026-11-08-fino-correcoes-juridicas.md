# Fino Legal Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make what Fino's texts promise match what the code does, and fix the highest legal risks that don't depend on the company existing: SMS consent, auto-renewal notice and acceptance records, terms/privacy content, and proof for the groomer's service agreement.

**Architecture:** Same patterns as Wave 1: migrations in `db/migrations` (next number 0048), data functions take `StaffContext` and filter by `business_id`, owner strings through `t()/msg()` with translations appended via `scripts/owner-keys.mjs` + `scripts/owner-assemble.mjs`, client strings through `t()` in the 19 `src/lib/i18n/messages/*.ts` files, and Playwright e2e scripts.

**Tech Stack:** Next.js 16.4 (read `node_modules/next/dist/docs/` before writing routes/actions), React 19.3, Tailwind v4, postgres.js, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-08-fino-correcoes-juridicas-design.md`

## Global Constraints
- The company placeholders live only in `src/lib/legal.ts`: `company "[NOME DA EMPRESA]"`, `address "[ENDEREÇO]"`, `jurisdiction "[FORO E LEI APLICÁVEL]"`, `supportEmail` = `process.env.SUPPORT_EMAIL` or `"[E-MAIL DE SUPORTE]"`, `termsVersion "2026-11-08"`. Placeholders are shown verbatim.
- Refund policy (owner's option 2):
  - monthly: no refunds; the plan runs to the end of the period;
  - yearly: prorated refund if requested within 14 days of the charge, by email to support, handled by hand.
- Terms and Privacy stay in English, in the existing `legal-page.tsx` layout.
- This is not legal advice. Nothing claims "verified" or "compliant".
- No new npm dependency.
- Stripe-mode billing behaviour does not change, except for the new required acceptance box and the notice text.
- Commits in English, with the session's two attribution lines. Never push to master.

## Review Focus
1. **Returning client re-booking online:** a client who already consented must not lose consent because the box is now unchecked. Unchecked means "no change", never "revoke". → Task 2 assertion.
2. **Editing the agreement without "ask everyone to sign again":** existing signatures still count, and still show the text they signed. → Task 6 assertion.
3. **The Stripe path with the new acceptance box:** `choosePlanAction` refuses without the box in both fake and Stripe modes, and the refusal comes before any Stripe call. → Task 4 assertion (fake mode e2e plus a code-path check in review).
4. **Reminder emails sent twice:** the cron runs hourly, so each reminder goes out once per business per period. → Task 5 assertion (run the cron twice).
5. **A legal page with `SUPPORT_EMAIL` unset:** it shows the placeholder and never renders "undefined". → Task 1 assertion.

---

### Task 1: Company placeholders, Terms, Privacy and public contact

**Files:**
- Create: `src/lib/legal.ts`
- Modify: `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`, `src/app/site-chrome.tsx` (footer: "© {year} {company}" and the support email), the site FAQ copy in `src/app/site-copy.ts` / `src/app/landing-copy.ts` (the trial/48-hour rule from spec B6, and the refund policy), `src/lib/marketing-email.ts` and `src/app/book/booking-wizard.tsx` (the "Bay Area" text shows only for the demo business; check the existing `hasBuiltInArtwork` condition and apply the same to both)
- Test: `tests/e2e/legal-pages.mjs` (new)

**Interfaces:**
- Produces: `export const LEGAL: { company: string; address: string; jurisdiction: string; supportEmail: string; termsVersion: string }`.

Steps:
- [ ] Write `legal-pages.mjs`.
  - `/terms` contains every heading in spec section C (Terms) and the texts "[NOME DA EMPRESA]", "[FORO E LEI APLICÁVEL]", "14 days", "prorated".
  - `/privacy` contains every heading in spec section C (Privacy), each subprocessor name in the spec list, and the cookie names.
  - Both pages, and the site footer on `/`, show a `mailto:` link whose text is `SUPPORT_EMAIL`, or "[E-MAIL DE SUPORTE]" when unset. The dev server here has it unset. No page contains "undefined".
  - A marketing email rendered for a non-demo business has no "Bay Area". Call the renderer with tsx, or send a test campaign to the mail catcher.
  - Run → FAIL.
- [ ] Implement.
  - Grep the code for every factual claim before writing it. These include:
    - data export contents (`src/lib/backup.ts`);
    - cookies (`auth.ts`, `i18n/server.ts`, the PIN `sessionStorage`);
    - subprocessors (email, maps, `help/assistant.ts`, Stripe, Drive backup);
    - referral and coupon rules (`discounts.ts`).
  - Remove "the app honors STOP" wording. Use the spec's correct text.
  - "Last updated" = `LEGAL.termsVersion`.
- [ ] Run → PASS. Also run `a11y.mjs` and `site.mjs`, typecheck and lint.
- [ ] Commit: `Terms and Privacy rewritten in plain English, with company placeholders and a public contact`.

### Task 2: SMS consent defaults, source and import attestation

**Files:**
- Migration `db/migrations/0048_consent_source.sql`: `clients.sms_consent_source text check (sms_consent_source in ('booking','intake','manual','import_attested'))`. Existing rows with consent get `'legacy'`; add `'legacy'` to the check.
- Modify:
  - `src/app/book/booking-wizard.tsx` (consent `useState(false)`), `src/app/book/actions.ts`
  - `src/app/intake/intake-form.tsx`, `src/app/intake/actions.ts`
  - `src/app/(owner)/clients/forms.tsx`, `src/app/(owner)/clients/actions.ts`
  - `src/lib/import/write-clients.ts` and the import screen under `src/app/(owner)/settings/import`
  - the client screen's consent hint (where the owner unchecks consent)
  - `src/app/u/[token]/page.tsx` (all strings through the client `t()`, translated in the 19 message files, and added to `tests/i18n-check.mjs`)
- Test: `tests/e2e/consent.mjs` (new)

Steps:
- [ ] Write `consent.mjs`. It asserts:
  - the booking page, the intake form and the owner's new-client form all start with the consent box unchecked;
  - booking with the box checked stores consent and `sms_consent_source = 'booking'`;
  - a returning client who already consented books again with the box unchecked and keeps consent (Review Focus 1);
  - a CSV import without the new box ("I have written consent from these clients to text them") stores no consent; with the box, `import_attested`;
  - `/u/<token>?lang=es` shows Spanish text.

  Run → FAIL.
- [ ] Implement.
  - Unchecked never revokes, except on the owner's own edit form, where unchecking already revokes today. Keep that behaviour.
  - Check whether any marketing SMS path exists (grep `send_sms` in marketing). If it does, gate it on consent like reminders. If none exists, write "no marketing SMS path" in the report.
- [ ] Run `consent.mjs`, `booking.mjs`, `import-world.mjs` and `i18n-check` → PASS. Typecheck and lint.
- [ ] Commit: `SMS consent starts unchecked, records where it came from; imports need the owner's attestation`.

### Task 3: Terms acceptance records

**Files:**
- Migration `0049_terms_acceptances.sql`: `terms_acceptances (id uuid pk, business_id uuid not null references businesses on delete cascade, user_id uuid references users on delete set null, terms_version text not null, accepted_at timestamptz not null default now(), ip text, context text not null check (context in ('signup','checkout')))`, with an index on `(business_id, accepted_at desc)` and RLS enabled like the others.
- Create `src/lib/data/terms.ts`.
- Modify `src/app/signup/actions.ts` (record after the account is created, in the same transaction if one exists).
- Test: `tests/e2e/consent.mjs`, or the new `tests/e2e/checkout-terms.mjs` used in Task 4. Put the signup assertion in `signup.mjs`.

**Interfaces:**
- Produces: `export async function recordTermsAcceptance(tx: Sql | TransactionSql, a: { businessId: string; userId: string | null; context: "signup" | "checkout"; ip: string | null }): Promise<void>`. It always writes `LEGAL.termsVersion`. Get the IP with `clientIp()` from `src/lib/rate-limit.ts`.

Steps:
- [ ] In `signup.mjs`, after a signup, assert one row in `terms_acceptances` with `context = 'signup'` and `terms_version = '2026-11-08'`. Run → FAIL.
- [ ] Implement. Run `signup.mjs` → PASS. Typecheck and lint.
- [ ] Commit: `Record each acceptance of the Terms with its version, date and IP`.

### Task 4: Auto-renewal notice and required acceptance when choosing a plan

**Files:**
- Modify:
  - `src/app/billing/page.tsx`: the notice next to each plan button, and a required checkbox `name="accept_terms"` labelled "I have read and accept the Terms and the automatic renewal", linking to /terms
  - `src/app/billing/actions.ts` (`choosePlanAction`): refuse without `accept_terms`, before any Stripe or fake call, redirecting back with `?terms_error=1` and a visible message; on accept, `recordTermsAcceptance(..., context: "checkout")`
  - `src/app/billing/fake-checkout/page.tsx`: the same notice
- Copy (owner phrases):
  - "Renews automatically every month for {price} until you cancel. Cancel anytime in Plan; you keep access until the end of the paid period."
  - "Renews automatically every year for {price} until you cancel. Cancel anytime in Plan; you keep access until the end of the paid period. Yearly plans can be refunded pro rata if you ask within 14 days of the charge."
- Test: `tests/e2e/fake-billing.mjs` (add steps)

Steps:
- [ ] Add steps to `fake-billing.mjs`:
  - /billing shows both notice texts;
  - choosing monthly without the box stays on /billing with the error, and creates no plan change and no acceptance row;
  - with the box, it proceeds and creates one `checkout` row.

  Update the existing steps so they tick the box. Run → FAIL.
- [ ] Implement.
- [ ] Run `fake-billing.mjs` and `admin.mjs` → PASS. Typecheck and lint.
- [ ] Commit: `Plan page: auto-renewal notice and a required acceptance of the Terms`.

### Task 5: Reminders before the first charge and before the yearly renewal

**Files:**
- Modify `src/lib/lifecycle.ts`, following how the existing kinds dedupe (read its once-per-kind mechanism and reuse it).
- New kinds:
  - **`first_charge_3d`:** a plan was chosen during the trial (`stripe_subscription_id is not null`, `plan_status` as set by `applyPlan` while the trial is kept: read `billing.ts` and `fake-payments.ts` for the exact state). The trial ends in 1 to 3 days. The email gives the date and the amount.
  - **`yearly_renewal_15d`:** `plan_interval = 'year'`, `plan_period_end` in 14 to 15 days, and not `plan_cancel_at_period_end`. Send once per period: put the period end in the dedupe key.
- Email texts go in the owner's language like the other lifecycle emails (owner phrases).
- Test: `tests/e2e/lifecycle.mjs` (add steps). Its header says it needs the server with `CRON_SECRET=test-cron`; the controller restarts the server that way for this task.

Steps:
- [ ] Add steps to `lifecycle.mjs`. For each case, set the state with SQL, call the cron twice, and assert exactly one email of that kind in MAIL_DIR, with the right date and amount:
  - a business with a chosen plan and the trial ending in 2 days;
  - a yearly business renewing in 14.5 days;
  - a cancelled-at-period-end yearly business gets no email.

  Run → FAIL.
- [ ] Implement. Run `lifecycle.mjs` → PASS. Typecheck and lint.
- [ ] Commit: `Emails before the first charge and before a yearly renewal, once each`.

### Task 6: Immutable versions of the groomer's service agreement

**Files:**
- Migration `0050_agreement_versions.sql`:
  - `agreement_versions (agreement_id uuid not null references agreements on delete cascade, version int not null, title text not null, body text not null, created_at timestamptz not null default now(), primary key (agreement_id, version))`;
  - backfill one row per agreement from its current `title`/`body`/`version`;
  - `alter table agreements add column if not exists resign_from_version int not null default 1`, backfilled to the current version.
- Modify:
  - `src/app/(owner)/settings/actions.ts` (the agreement save, about lines 253-254): every text change inserts a new version (`version + 1`) and updates `agreements`. "Ask everyone to sign again" sets `resign_from_version` to the new version. Otherwise it stays.
  - Where "is this client's signature still valid" is decided (`src/lib/agreement.ts`): valid when `signature.agreement_version >= resign_from_version`, plus the existing 12-month rule.
  - The place that shows a client's signed agreement (find it: client page and/or `/s/[token]`) shows the text of the version they signed, from `agreement_versions`.
  - `src/app/(owner)/clients/actions.ts` and its UI: the delete confirmation adds "Their signed agreements will be deleted too."
- Test: `tests/e2e/agreement-versions.mjs` (new)

Steps:
- [ ] Write `agreement-versions.mjs`:
  - a client signs version 1;
  - the owner edits the text without "sign again": a version 2 row exists, the client's signature is still valid, and their signed text still shows version 1's body (Review Focus 2);
  - the owner edits with "sign again": the signature is no longer valid;
  - the delete-client confirmation contains the new sentence.

  Run → FAIL.
- [ ] Implement. Run it, `agreement-options.mjs` and `booking.mjs` → PASS. Typecheck and lint.
- [ ] Commit: `Service agreement: every edit is a new kept version; signatures point to the text signed`.

### Task 7: Starter agreement in the owner's language, no-show fee, 12 months

**Files:**
- Modify:
  - `src/lib/new-business.ts` (`starterAgreement`): translated through the owner `t` for the business language, as the starter services already are. Add the line "This agreement is valid for 12 months from signing." and a `{no_show_fee}` placeholder in the late-cancellation/no-show paragraph.
  - The agreement settings screen: a "No-show fee" money field stored as `agreements.no_show_fee_cents int`, added in migration `0051_no_show_fee.sql`.
  - The rendering of the agreement text, which replaces `{no_show_fee}` with `money()` of it, or "a fee" when null.
- Test: extend `agreement-versions.mjs`:
  - a business created with lang pt has a Portuguese starter agreement;
  - setting the fee to 25.00 shows "$25.00" in the client's agreement text.

Steps:
- [ ] Add the assertions → FAIL. Implement → PASS. Run `signup.mjs` and `welcome.mjs`. Typecheck and lint.
- [ ] Commit: `Starter agreement in the owner's language, with a no-show fee and a 12-month validity`.

### Task 8: Owner translations, accessibility, docs

- [ ] Run `node scripts/owner-keys.mjs`. Translate the new owner phrases into the 19 languages: append them in order, keep placeholders identical, and assemble with `scripts/owner-assemble.mjs`. Expected: 0 left in English among the new indices.
- [ ] Run `a11y.mjs` with `/terms`, `/privacy` and `/u/<token>` added if they are not already in it. Run `languages.mjs` and `i18n-check`. All PASS.
- [ ] In `docs/pendencias.md` (Portuguese), add:
  - what changed;
  - the list of placeholders to fill in `src/lib/legal.ts`, plus `SUPPORT_EMAIL` on Netlify;
  - the refund policy;
  - the open questions for the lawyer and the accountant (copy section 5 of the legal review).
- [ ] Run the e2e tests touched by this plan on a fresh DB, plus `slice`, `report-card`, `powered-by`, `kpis` and `fill-gap`, and record a results table.
- [ ] Commit: `Legal fixes: translations, accessibility and the owner's checklist`.
