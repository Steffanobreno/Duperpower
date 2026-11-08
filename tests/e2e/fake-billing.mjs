// Test mode payments (no Stripe key, NODE_ENV=development → the fake gateway), end to end.
// Run after slice.mjs, with DATABASE_URL, ADMIN_EMAILS=owner@example.com and CRON_SECRET on the
// server (CRON_SECRET here too if it isn't "test-cron-secret").
// Banner on /admin and /billing → the admin makes a 50%-once code (no Stripe ids) → a groomer
// picks monthly in the trial: the fake checkout shows US$29 and keeps the trial → Pay → active ·
// a second groomer types the code (a wrong one is refused): US$14.50 today → Pay → active · a
// referred groomer gets the first month free; the referrer's US$29 credit comes once, when the
// referred groomer's first paid (renewal) invoice is paid · the fake portal: Cancel at period end
// → Resume; cancelled at the period end ends the plan · Stripe's webhook stays off.
// Usage: node tests/e2e/fake-billing.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET ?? "test-cron-secret";
const db = postgres(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/woofers", { max: 1 });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const BANNER = "Test mode — no real charges";
const newPage = async (width = 390) => {
  const p = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
};
const stamp = Date.now();
async function signUp(page, business, email, path = "/signup") {
  await page.goto(`${BASE}${path}`);
  await page.getByLabel("Business name").fill(business);
  await page.getByLabel("Your name").fill("Rae");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("sudsy sudsy 123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create my account" }).click();
  await page.waitForURL(/\/welcome/);
  const [b] = await db`select b.id from businesses b join staff s on s.business_id = b.id join users u on u.id = s.user_id where u.email = ${email}`;
  return b.id;
}
/** Picks a plan on /billing (with a code, maybe): lands on the fake checkout or back with an error. */
async function choose(page, plan, code = "") {
  await page.goto(`${BASE}/billing`);
  await page.getByLabel("Discount or referral code (optional)").fill(code);
  await page.getByRole("button", { name: plan }).click();
  await page.waitForURL(/fake-checkout|code_error|error=1/);
  return page.url();
}
async function pay(page) {
  await page.getByRole("button", { name: "Pay (test)" }).click();
  await page.waitForURL(/\/billing\?done=1/);
}
const plan = async (id) => (await db`
  select plan_status, plan_interval, plan_amount_cents, plan_currency, plan_period_end, plan_cancel_at_period_end,
         stripe_customer_id, stripe_subscription_id, trial_ends_at
  from businesses where id = ${id}`)[0];
/** The hourly job: renews (or ends) the test subscriptions whose period is over. */
async function cron() {
  const res = await fetch(`${BASE}/api/cron/messages`, { headers: { authorization: `Bearer ${CRON_SECRET}` } });
  if (!res.ok) fail(`cron → ${res.status}`);
}
const near = (a, b, ms = 120_000) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) < ms;
const monthFromNow = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; };

// 1. The app owner sees the banner in /admin and makes a discount code: no Stripe ids.
const admin = await newPage(1100);
await admin.goto(`${BASE}/login`);
await admin.fill('input[name="email"]', "owner@example.com");
await admin.fill('input[name="password"]', "correct horse battery");
await admin.click('button[type="submit"]');
await admin.waitForURL(/\/today/);
await admin.goto(`${BASE}/admin`);
await admin.getByText("Modo de teste — nenhuma cobrança real").first().waitFor();
const CODE = `HALF${String(stamp).slice(-6)}`;
await admin.goto(`${BASE}/admin/codes`);
await admin.getByText("Modo de teste — nenhuma cobrança real").first().waitFor();
await admin.fill('input[name="code"]', CODE.toLowerCase());
await admin.fill('input[name="value"]', "50");
await admin.getByRole("button", { name: "Criar código" }).click();
await admin.getByText("Código criado.").waitFor();
const [made] = await db`select percent_off, duration, stripe_coupon_id, stripe_promotion_code_id from discount_codes where code = ${CODE}`;
if (!made || Number(made.percent_off) !== 50 || made.duration !== "once" || made.stripe_coupon_id !== null || made.stripe_promotion_code_id !== null) {
  fail(`the code should be saved 50% once without Stripe ids: ${JSON.stringify(made)}`);
}
step("admin: the test-mode banner; a discount code is saved without Stripe ids");

// 2. A new groomer: banner on the plan page, monthly in the trial → US$29, the trial kept → Pay → active.
const a = await newPage();
const aId = await signUp(a, "Sudsy Test Spa", `fake-a${stamp}@example.com`);
await a.goto(`${BASE}/billing`);
await a.getByText(BANNER).waitFor();
await a.getByText(/Free trial: 14 days left/).waitFor();
if (!(await choose(a, "Choose monthly")).includes("/billing/fake-checkout?interval=month")) fail(`monthly should open the fake checkout: ${a.url()}`);
await a.getByText(BANNER).waitFor();
await a.getByText("Monthly", { exact: true }).waitFor();
await a.getByText("$29/month").waitFor();
await a.getByText(/Your free trial is kept: the first payment is on/).waitFor();
await pay(a);
const pa = await plan(aId);
if (pa.plan_status !== "active" || pa.plan_interval !== "month" || pa.plan_amount_cents !== 2900 || pa.plan_currency !== "USD"
  || pa.stripe_customer_id !== `fake_cus_${aId}` || pa.stripe_subscription_id !== `fake_sub_${aId}` || pa.plan_cancel_at_period_end
  || !near(pa.plan_period_end, pa.trial_ends_at, 1000)) fail(`the plan should be active, monthly, until the trial ends: ${JSON.stringify(pa)}`);
await a.getByText(/Monthly plan · renews on/).waitFor();
await a.getByText(BANNER).waitFor();
step("a groomer picks monthly in the trial: fake checkout with US$29 and the trial kept → Pay → active in the DB and UI");

// 3. A second groomer (trial ending within 48 hours: charged now) types the code; a wrong one is refused.
const b = await newPage();
const bId = await signUp(b, "Half Price Paws", `fake-b${stamp}@example.com`);
await db`update businesses set trial_ends_at = now() + interval '1 hour' where id = ${bId}`;
if (!(await choose(b, "Choose monthly", "NOPE-CODE")).includes("code_error=bad")) fail("a wrong code should be refused");
await b.getByText("That code doesn't exist or has expired.").waitFor();
await choose(b, "Choose monthly", CODE.toLowerCase());
await b.getByText(`Code ${CODE}: 50% off`).waitFor();
await b.getByText("first payment only").waitFor();
await b.getByText("$14.50").first().waitFor();
if (await b.getByText(/Your free trial is kept/).count()) fail("a trial ending within 48 hours isn't kept");
await pay(b);
const pb = await plan(bId);
if (pb.plan_status !== "active" || pb.plan_amount_cents !== 2900 || !near(pb.plan_period_end, monthFromNow(), 3 * 86_400_000)) {
  fail(`the second groomer's plan should be active for a month: ${JSON.stringify(pb)}`);
}
await admin.goto(`${BASE}/admin/codes`);
await admin.locator("div", { has: admin.getByText(CODE, { exact: true }) }).last().getByText(/^1 usos/).waitFor();
step("a /admin code (50% once) is applied on a second business: US$14.50 now → active; a wrong code is refused; the admin sees 1 use");

// 4. A referred groomer: first month free; the referrer's credit comes once, with the first paid invoice.
await a.goto(`${BASE}/billing`);
const refCode = await a.getByLabel("Your referral code").inputValue();
const c = await newPage();
const cId = await signUp(c, "Bubbly Test Paws", `fake-c${stamp}@example.com`, `/signup?ref=${refCode}`);
await db`update businesses set trial_ends_at = now() + interval '1 hour' where id = ${cId}`;
const own = await (async () => { await c.goto(`${BASE}/billing`); return c.getByLabel("Your referral code").inputValue(); })();
if (!(await choose(c, "Choose monthly", own)).includes("code_error=own")) fail("their own code should be refused");
await c.getByText("That's your own referral code: share it with other groomers.").waitFor();
await choose(c, "Choose monthly");
await c.getByText("Referral: first month free").waitFor();
await c.getByText("$0").first().waitFor();
await pay(c);
if ((await plan(cId)).plan_status !== "active") fail("the referred groomer's plan should be active");
const rewarded = async () => (await db`select rewarded_at, reward_cents from referrals where referred_id = ${cId}`)[0];
if ((await rewarded()).rewarded_at) fail("a US$0 invoice (the free month) shouldn't give the referrer credit");
// The free month ends: the first paid invoice (US$29) → the referrer's credit, once.
await db`update businesses set plan_period_end = now() - interval '1 minute' where id = ${cId}`;
await cron();
const r1 = await rewarded();
const pc = await plan(cId);
if (!r1.rewarded_at || r1.reward_cents !== 2900) fail(`the first paid invoice should give the referrer US$29: ${JSON.stringify(r1)}`);
if (pc.plan_status !== "active" || !(new Date(pc.plan_period_end).getTime() > Date.now())) fail(`the renewal should start a new period: ${JSON.stringify(pc)}`);
await db`update businesses set plan_period_end = now() - interval '1 minute' where id = ${cId}`;
await cron();
const r2 = await rewarded();
if (r2.rewarded_at.getTime() !== r1.rewarded_at.getTime()) fail("the credit is given once");
const [{ credit }] = await db`select coalesce(sum(reward_cents), 0)::int as credit from referrals where referrer_id = ${aId}`;
if (credit !== 2900) fail(`the referrer should have US$29 of credit, once: ${credit}`);
await a.goto(`${BASE}/billing`);
await a.getByText(/1 joined with your code · \$29 in credit so far/).waitFor();
step("a referred signup gets the first month free; the referrer's US$29 credit appears once, after the first paid invoice");

// 5. The fake portal: Cancel at period end → Resume.
await a.goto(`${BASE}/billing`);
await a.getByRole("button", { name: /Manage billing/ }).click();
await a.waitForURL(/\/billing\/fake-portal/);
await a.getByText(BANNER).waitFor();
await a.getByText(/Monthly · \$29\/month/).waitFor();
await a.getByText(/Next renewal:/).waitFor();
await a.getByRole("button", { name: "Cancel at period end" }).click();
await a.getByRole("button", { name: "Resume" }).waitFor();
if (!(await plan(aId)).plan_cancel_at_period_end) fail("Cancel at period end should set cancel_at_period_end");
await a.getByText(/Your plan ends on/).waitFor();
await a.getByRole("button", { name: "Resume" }).click();
await a.getByRole("button", { name: "Cancel at period end" }).waitFor();
if ((await plan(aId)).plan_cancel_at_period_end) fail("Resume should clear cancel_at_period_end");
step("fake portal: Cancel at period end → true, Resume → false");

// 6. Cancelled at the period end: the plan ends when the period does (no renewal, no charge).
await b.goto(`${BASE}/billing/fake-portal`);
await b.getByRole("button", { name: "Cancel at period end" }).click();
await b.getByRole("button", { name: "Resume" }).waitFor();
await db`update businesses set plan_period_end = now() - interval '1 minute' where id = ${bId}`;
await cron();
if ((await plan(bId)).plan_status !== "cancelled") fail("a plan cancelled at period end should end when the period does");
step("a plan cancelled at period end ends when the period does");

// 7. Stripe's webhook stays off without Stripe.
const hook = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", body: "{}" });
if (hook.status !== 503) fail(`the Stripe webhook should stay off in test mode (got ${hook.status})`);
step("Stripe's webhook stays off in test mode");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await db.end();
await browser.close();
console.log("fake-billing: all good");
