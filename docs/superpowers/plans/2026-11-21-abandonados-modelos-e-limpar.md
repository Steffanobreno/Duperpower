# Abandonados: 20 modelos e "Clear recovered" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dropdown with 20 ready messages (plus Random, Finish booking and Sorry) on "Send to all", and a "Clear recovered (N)" button on Abandonados that keeps the stats.

**Architecture:** The 20 texts live in `src/lib/abandoned-templates.ts` (shared by client and server). `SendAll` swaps its two chips for a native `<select>`; the form posts `body` or `mode=random`, and `sendAllAction` picks one of the 20 texts per person when the mode is random. A new server action sets `dismissed_at` on every recovered draft; `draftStats` counts recovered drafts even when they are dismissed.

**Tech Stack:** Next.js 16 server actions, postgres.js, Playwright e2e (`tests/e2e/*.mjs`), owner i18n (`scripts/owner-keys.mjs` + 19 positional files).

**Spec:** `docs/superpowers/specs/2026-11-21-abandonados-modelos-e-limpar-design.md`

## Global Constraints
- Free: no paid API.
- The 20 messages are in English, use only `{client}`, `{pet}`, `{business}`, `{booking_url}`, and are each ≤ 320 characters.
- Every new owner-facing phrase gets translated in all 19 languages, appended in the same order.
- The default selection when the page opens stays the business's own "Finish booking" message.

## Review Focus
- Random with an edited box: the box is hidden in Random, and the server ignores `body` when `mode=random`. Test: Random sends ≥2 distinct bodies to 3+ people.
- Clear with nobody recovered: the button is hidden. Test: it isn't shown when the count is 0.
- After clearing, the stats still show the recovered count and revenue. Test: the numbers are the same before and after.
- Clearing must not hide drafts that weren't recovered. Test: an abandoned draft stays in the list.
- A template placeholder misspelled leaks raw `{...}` to clients. Test: a unit check in the e2e that every template only uses the 4 allowed placeholders.

---

### Task 1: The 20 templates and the dropdown with Random

**Files:**
- Create: `src/lib/abandoned-templates.ts`
- Modify: `src/app/(owner)/abandoned/send/send-all.tsx`, `src/app/(owner)/abandoned/send/page.tsx`, `src/app/(owner)/abandoned/send-actions.ts`
- Test: `tests/e2e/abandoned-send-all.mjs`

**Interfaces:**
- Produces: `export const ABANDONED_TEMPLATES: string[]` (20 entries); `export function pickTemplate(rand?: () => number): string`.
- Form fields: `mode` = `"random"` | `"one"`; `body` (used only when the mode is `"one"`).

- [ ] Extend the e2e: the select (label "Message to start from") has 23 options; picking template #5 puts its text in the box; Random hides the box, and sending to 3 drafts queues ≥2 distinct email bodies; no body contains `{`.
- [ ] Run it and see it fail.
- [ ] Implement it; translate the new phrases (run `node scripts/owner-keys.mjs`, then append to the 19 files).
- [ ] Run the e2e, typecheck and lint.
- [ ] Commit.

### Task 2: Clear recovered

**Files:**
- Modify: `src/app/(owner)/abandoned/page.tsx`, `src/app/(owner)/abandoned/actions.ts` (add `clearRecoveredAction(): Promise<void>`), `src/lib/data/abandoned.ts` (`draftStats` includes dismissed recovered drafts)
- Test: `tests/e2e/abandoned-send-all.mjs` (new section)

- [ ] e2e: with 1 recovered and 1 abandoned draft, "Clear recovered (1)" is shown; after the tap, the recovered draft is gone from the list, the abandoned one stays, and the stats are unchanged; with 0 recovered, the button is absent.
- [ ] Run it and see it fail.
- [ ] Implement it and translate.
- [ ] Run the e2e, abandoned.mjs, typecheck and lint.
- [ ] Commit; update `docs/pendencias.md`.
