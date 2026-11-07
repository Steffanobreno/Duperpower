// The owners' own emails and the server-error alert, end to end. Run after slice.mjs, with the
// dev server started with CRON_SECRET=test-cron, ADMIN_EMAILS=owner@example.com, billing on
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
  const res = await fetch(`${BASE}/api/cron/messages`, { headers: { authorization: "Bearer test-cron" } });
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
