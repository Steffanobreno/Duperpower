// The owners' own emails and the server-error alert, end to end. Run after slice.mjs, with the
// dev server started with CRON_SECRET (default test-cron), ADMIN_EMAILS=owner@example.com, billing on
// (STRIPE_SECRET_KEY) and email to a local mail catcher whose folder is MAIL_DIR.
// First visit reminder (2+ days, nothing booked) → trial ends in 3 days → tomorrow → ended, each
// once and in the owner's language → a server error is listed in /admin/errors and emailed once.
// Usage: MAIL_DIR=/path DATABASE_URL=... node tests/e2e/lifecycle.mjs [baseUrl]
import { readdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const MAIL_DIR = process.env.MAIL_DIR;
if (!MAIL_DIR) throw new Error("Set MAIL_DIR");
const db = postgres(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/woofers", { max: 1 });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
// Subjects are MIME-encoded when not plain ASCII; decode them for the checks.
const decodeWords = (s) => s.replace(/=\?utf-8\?([bq])\?([^?]*)\?=\s*/gi, (_, enc, text) =>
  enc.toLowerCase() === "b" ? Buffer.from(text, "base64").toString("utf8")
    : Buffer.from(text.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (__, h) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8"));
const mails = () => readdirSync(MAIL_DIR).sort().map((f) => readFileSync(`${MAIL_DIR}/${f}`, "latin1"));
const subjectsTo = (from, email) => mails().slice(from)
  .filter((m) => new RegExp(`^To: .*${email.replace(/[.+]/g, "\\$&")}`, "mi").test(m))
  .map((m) => decodeWords((m.match(/^Subject: (.*(?:\r?\n[ \t].*)*)/m)?.[1] ?? "").replace(/\r?\n[ \t]/g, " ")));
const cron = async () => {
  const res = await fetch(`${BASE}/api/cron/messages`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? "test-cron"}` } });
  if (!res.ok) fail(`cron → ${res.status}`);
  await new Promise((r) => setTimeout(r, 800));
};

// A groomer signs up (trial, nothing booked yet).
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const email = `life${Date.now()}@example.com`;
await page.goto(`${BASE}/signup`);
await page.getByLabel("Business name").fill("Lather Lane");
await page.getByLabel("Your name").fill("Rae");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("sudsy sudsy 123");
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: "Create my account" }).click();
await page.waitForURL(/\/welcome/);
const [biz] = await db`select b.id from businesses b join staff s on s.business_id = b.id join users u on u.id = s.user_id where u.email = ${email}`;

// Day 0: nothing yet. Day 3 with nothing booked: the first-visit email, once.
let from = mails().length;
await cron();
if (subjectsTo(from, email).length) fail(`no email on the first day: ${subjectsTo(from, email)}`);
await db`update businesses set created_at = now() - interval '3 days' where id = ${biz.id}`;
await cron();
await cron();
let got = subjectsTo(from, email);
if (got.length !== 1 || !/Book your first visit in Fino/.test(got[0])) fail(`one first-visit email expected: ${JSON.stringify(got)}`);
step("2+ days after signing up with nothing booked: one email on how to book the first visit");

// The trial ends in 3 days → tomorrow → it ended: one email each.
for (const [interval, subject] of [["2 days", /free trial ends in 3 days/], ["12 hours", /free trial ends tomorrow/], ["-1 day", /free trial has ended/]]) {
  from = mails().length;
  await db`update businesses set trial_ends_at = now() + ${interval}::interval where id = ${biz.id}`;
  await cron();
  await cron();
  got = subjectsTo(from, email);
  if (got.length !== 1 || !subject.test(got[0])) fail(`one "${subject}" email expected: ${JSON.stringify(got)}`);
}
step("the trial ending: 3 days before, the day before and after it ends, one email each");

// In the owner's language; and nothing once a plan was chosen.
const email2 = `vida${Date.now()}@example.com`;
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR", extraHTTPHeaders: { "Accept-Language": "pt-BR" } });
const p2 = await ctx2.newPage();
await p2.goto(`${BASE}/signup`);
await p2.locator('input[name="business"]').fill("Banho Bom");
await p2.locator('input[name="name"]').fill("Ana");
await p2.locator('input[name="email"]').fill(email2);
await p2.locator('input[name="password"]').fill("sudsy sudsy 123");
await p2.getByRole("checkbox").check();
await p2.locator('button[type="submit"]').click();
await p2.waitForURL(/\/welcome/);
const [biz2] = await db`select b.id from businesses b join staff s on s.business_id = b.id join users u on u.id = s.user_id where u.email = ${email2}`;
await db`update staff set language = 'pt' where business_id = ${biz2.id}`;
from = mails().length;
await db`update businesses set trial_ends_at = now() + interval '2 days', created_at = now() - interval '1 day' where id = ${biz2.id}`;
await cron();
got = subjectsTo(from, email2);
if (got.length !== 1 || !/Seu teste grátis do Fino acaba em 3 dias/.test(got[0])) fail(`a Portuguese email expected: ${JSON.stringify(got)}`);
from = mails().length;
await db`update businesses set trial_ends_at = now() + interval '12 hours', stripe_subscription_id = 'sub_chosen' where id = ${biz2.id}`;
await cron();
if (subjectsTo(from, email2).length) fail("no trial email once a plan was chosen");
step("in the owner's language (Portuguese); none once a plan was chosen");

// A plan chosen during the trial: "the first charge is on <date>, US$29", once. The state is what
// applyPlan leaves: active, a subscription, the period starting where the trial ends.
const bodyOf = (from, email, re) => {
  const m = mails().slice(from).find((x) => new RegExp(`^To: .*${email.replace(/[.+]/g, "\\$&")}`, "mi").test(x) && re.test(decodeWords(x.match(/^Subject: (.*(?:\r?\n[ \t].*)*)/m)?.[1] ?? "").replace(/\r?\n[ \t]/g, " ")));
  const body = (m ?? "").split(/\r?\n\r?\n/).slice(1).join("\n\n");
  return /quoted-printable/i.test(m ?? "") ? Buffer.from(body.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8") : body;
};
const longDate = (d) => d.toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const trialEnd = new Date(Date.now() + 2 * 86_400_000);
from = mails().length;
await db`update businesses set plan_status = 'active', stripe_subscription_id = ${`fake_sub_${biz.id}`}, fake_plan_discount = null, plan_interval = 'month', plan_amount_cents = 2900,
         trial_ends_at = ${trialEnd}, plan_period_end = ${trialEnd}, plan_cancel_at_period_end = false where id = ${biz.id}`;
await cron();
await cron();
got = subjectsTo(from, email);
if (got.length !== 1 || !/first charge/.test(got[0])) fail(`one first-charge email expected: ${JSON.stringify(got)}`);
let body = bodyOf(from, email, /first charge/);
if (!body.includes(longDate(trialEnd)) || !body.includes("US$29.00")) fail(`the first-charge email needs the date and amount: ${body}`);
step("a plan chosen during the trial: one email 2 days before the first charge, with its date and amount");

// A plan cancelled before the first charge is not charged either.
from = mails().length;
await db`delete from lifecycle_emails where business_id = ${biz.id} and kind = 'first_charge_3d'`;
await db`update businesses set plan_cancel_at_period_end = true where id = ${biz.id}`;
await cron();
if (subjectsTo(from, email).length) fail("no first-charge email for a plan cancelled before the first charge");
await db`update businesses set plan_cancel_at_period_end = false, plan_period_end = now() + interval '30 days' where id = ${biz.id}`;
await cron();
if (subjectsTo(from, email).length) fail("no first-charge email for a plan already charged");
step("none when the plan was cancelled or was charged at once (period ends a month on)");

// A yearly plan renewing in 14.5 days: one email with the date and amount; none when cancelled.
const renews = new Date(Date.now() + 14.5 * 86_400_000);
from = mails().length;
await db`update businesses set trial_ends_at = now() - interval '30 days', plan_interval = 'year', plan_amount_cents = 29000, plan_period_end = ${renews} where id = ${biz.id}`;
await cron();
await cron();
got = subjectsTo(from, email);
if (got.length !== 1 || !/yearly plan renews/.test(got[0])) fail(`one renewal email expected: ${JSON.stringify(got)}`);
body = bodyOf(from, email, /yearly plan renews/);
if (!body.includes(longDate(renews)) || !body.includes("US$290.00")) fail(`the renewal email needs the date and amount: ${body}`);
step("a yearly plan renewing in 14.5 days: one email with the date and amount");

from = mails().length;
await db`update businesses set plan_period_end = ${new Date(Date.now() + 14.5 * 86_400_000 + 1000)} where id = ${biz.id}`;
await cron();
if (subjectsTo(from, email).length) fail("a renewal email is sent once per period, not again for the same one");
await db`update businesses set plan_period_end = ${renews}, plan_cancel_at_period_end = true where id = ${biz.id}`;
await db`delete from lifecycle_emails where business_id = ${biz.id} and kind like 'yearly_renewal_15d%'`;
await cron();
if (subjectsTo(from, email).length) fail("no renewal email for a plan cancelled at period end");
step("a yearly plan cancelled at period end: no email");

// The amount is the real next charge, never the list price when a discount applies. Each case
// starts from a clean slate (nothing sent yet) and checks what the email says.
const chargeEmail = async (label, state, subject, check) => {
  await db`delete from lifecycle_emails where business_id = ${biz.id}`;
  await db`update businesses set plan_cancel_at_period_end = false ${state}  where id = ${biz.id}`;
  const f = mails().length;
  await cron();
  const s = subjectsTo(f, email);
  if (s.length !== 1 || !subject.test(s[0])) fail(`${label}: one "${subject}" email expected: ${JSON.stringify(s)}`);
  const b = bodyOf(f, email, subject);
  if (!check(b)) fail(`${label}: wrong text: ${b}`);
};
const soon = new Date(Date.now() + 2 * 86_400_000);
const monthly = (disc, sub = `fake_sub_${biz.id}`) => db`, plan_status = 'active', stripe_subscription_id = ${sub}, plan_interval = 'month', plan_amount_cents = 2900,
  trial_ends_at = ${soon}, plan_period_end = ${soon}, fake_plan_discount = ${disc ? db.json(disc) : null}`;
await chargeEmail("referred, first month free", monthly({ code: null, percentOff: null, amountOffCents: 2900, chargesLeft: 1 }), /first charge/,
  (b) => b.includes("US$0.00") && !b.includes("US$29"));
const yearlySoon = (disc) => db`, plan_status = 'active', stripe_subscription_id = ${`fake_sub_${biz.id}`}, plan_interval = 'year', plan_amount_cents = 29000,
  trial_ends_at = ${soon}, plan_period_end = ${soon}, fake_plan_discount = ${disc ? db.json(disc) : null}`;
await chargeEmail("50% once, yearly", yearlySoon({ code: "HALF", percentOff: 50, amountOffCents: null, chargesLeft: 1 }), /first charge/,
  (b) => b.includes("US$145.00") && !b.includes("US$290"));
step("the first-charge email shows the real amount after a discount (US$0.00 for a free first month, US$145.00 for 50% off a year)");

// The renewal after the discount is used up: the full price; with one left: the discount applies.
const in14 = new Date(Date.now() + 14 * 86_400_000);
const renewing = (disc, at) => db`, plan_status = 'active', stripe_subscription_id = ${`fake_sub_${biz.id}`}, plan_interval = 'year', plan_amount_cents = 29000,
  trial_ends_at = now() - interval '60 days', plan_period_end = ${at}, fake_plan_discount = ${disc ? db.json(disc) : null}`;
await chargeEmail("renewal with a discount left", renewing({ code: "HALF", percentOff: 50, amountOffCents: null, chargesLeft: 2 }, in14), /yearly plan renews/,
  (b) => b.includes("US$145.00"));
await chargeEmail("renewal, discount used up", renewing({ code: "HALF", percentOff: 50, amountOffCents: null, chargesLeft: 0 }, in14), /yearly plan renews/,
  (b) => b.includes("US$290.00"));
await chargeEmail("renewal in 13.5 days (a late cron still sends it)", renewing(null, new Date(Date.now() + 13.5 * 86_400_000)), /yearly plan renews/,
  (b) => b.includes("US$290.00"));
step("yearly renewal: the remaining discount counts; sent from 13 days before");

// An amount that can't be told (Stripe unreachable/not set up, or the plan price missing): the
// reminder still goes out, with the plan price and "less any discount", and no charge figure.
await chargeEmail("unknown amount (Stripe)", monthly(null, "sub_chosen"), /first charge/,
  (b) => /less any discount/.test(b) && !/we will charge/.test(b));
await chargeEmail("missing price", db`, plan_status = 'active', stripe_subscription_id = ${`fake_sub_${biz.id}`}, plan_interval = 'month', plan_amount_cents = null,
  trial_ends_at = ${soon}, plan_period_end = ${soon}`, /first charge/, (b) => /less any discount/.test(b));
step("amount unknown: a reminder with the plan price and 'less any discount', never the generic trial email");

// A server error → /admin/errors, and one email to the admin. The trigger: a groom photo link whose
// id has the right length and letters but isn't a real id (the database refuses it).
const admin = await (await browser.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
await admin.goto(`${BASE}/login`);
await admin.fill('input[name="email"]', "owner@example.com");
await admin.fill('input[name="password"]', "correct horse battery");
await admin.click('button[type="submit"]');
await admin.waitForURL(/\/today/);
from = mails().length;
for (let i = 0; i < 3; i++) await admin.goto(`${BASE}/api/grooms/${"a".repeat(36)}/photo`).catch(() => {});
await new Promise((r) => setTimeout(r, 1500));
const [err] = await db`select count, path, emailed_at from app_errors order by last_at desc limit 1`;
if (!err || err.count < 3 || !err.emailed_at) fail(`the error should be logged 3 times and emailed: ${JSON.stringify(err)}`);
const alerts = subjectsTo(from, "owner@example.com").filter((s) => /Erro no servidor/.test(s));
if (alerts.length !== 1) fail(`one alert email expected, got ${alerts.length}`);
await admin.goto(`${BASE}/admin/errors`);
await admin.getByText(/3×/).first().waitFor();
step("a server error: grouped in /admin/errors (3×) and emailed to the admin once");

await db.end();
await browser.close();
console.log("lifecycle: all good");
