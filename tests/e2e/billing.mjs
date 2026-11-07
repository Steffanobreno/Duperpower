// Plans and payment, end to end, against a fake Stripe (STRIPE_API_BASE) with
// STRIPE_WEBHOOK_SECRET=whsec_test on the server. Run after slice.mjs. Needs DATABASE_URL.
// Signup → free trial → choose monthly (Stripe Checkout) → Stripe's webhook makes it active →
// the dashboard counts it · the trial ends unpaid → the app opens only the plan page and the
// booking page pauses · the subscription is cancelled → locked again.
// Usage: node tests/e2e/billing.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";
import postgres from "postgres";
import Stripe from "stripe";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const db = postgres(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/woofers", { max: 1 });
const stripe = new Stripe("sk_test_fake");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on("pageerror", (e) => errors.push(e.message));
const shot = (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

const STRIPE_API = process.env.STRIPE_API_BASE ?? "http://127.0.0.1:4546";
/** Sets the subscription as the fake Stripe now has it (the app reads it back from there). */
const stripeHas = (sub) => fetch(`${STRIPE_API}/__subscriptions`, { method: "POST", body: JSON.stringify(sub) });

/** Sends Stripe's webhook the way Stripe signs it (the subscription is also what Stripe has now). */
async function webhook(type, object, { stale = false } = {}) {
  if (!stale && object.object === "subscription") await stripeHas(object);
  const payload = JSON.stringify({ id: `evt_${Date.now()}`, object: "event", type, data: { object }, api_version: "2026-09-30.endive" });
  const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret: "whsec_test" });
  const res = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", body: payload, headers: { "stripe-signature": header, "content-type": "application/json" } });
  if (!res.ok) fail(`webhook ${type} → ${res.status}`);
}

// A new groomer: free trial, then the plan page.
const email = `plan${Date.now()}@example.com`;
await page.goto(`${BASE}/signup`);
await page.getByLabel("Business name").fill("Sudsy Mobile Spa");
await page.getByLabel("Your name").fill("Rae");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("sudsy sudsy 123");
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: "Create my account" }).click();
await page.waitForURL(/\/welcome/);
const [biz] = await db`select b.id from businesses b join staff s on s.business_id = b.id join users u on u.id = s.user_id where u.email = ${email}`;
await page.goto(`${BASE}/billing`);
await page.getByText(/Free trial: 14 days left/).waitFor();
await shot("B01-plan-trial");
step("signup starts a 14-day free trial; the plan page shows it");

// Bad signatures are refused.
const bad = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", body: "{}", headers: { "stripe-signature": "t=1,v1=nope" } });
if (bad.status !== 400) fail(`a webhook with a bad signature should be refused (got ${bad.status})`);

// Choose monthly → Stripe Checkout (the fake sends straight back) → the webhook activates it.
await page.getByRole("button", { name: "Choose monthly" }).click();
// Stripe sends the groomer back to APP_URL (in tests it may be another host name): open it here.
await page.waitForURL(/done=1|login/);
await page.goto(`${BASE}/billing?done=1`);
await page.getByText(/Your plan is being activated/).waitFor();
const [{ stripe_customer_id: customer }] = await db`select stripe_customer_id from businesses where id = ${biz.id}`;
if (!customer) fail("choosing a plan should create the Stripe customer");
const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
const subscription = (status, extra = {}) => ({
  id: "sub_test", object: "subscription", customer, status, cancel_at_period_end: false, metadata: { business_id: biz.id },
  items: { object: "list", data: [{ id: "si_1", current_period_end: periodEnd, price: { id: "price_1", unit_amount: 2900, currency: "usd", recurring: { interval: "month" } } }] },
  ...extra,
});
await webhook("customer.subscription.created", subscription("active"));
await page.goto(`${BASE}/billing`);
await page.getByText(/Monthly plan · renews on/).waitFor();
await page.getByRole("button", { name: /Manage billing/ }).click();
await page.waitForURL(/portal=1|login/);
await page.goto(`${BASE}/billing`);
const [plan] = await db`select plan_status, plan_amount_cents, plan_interval from businesses where id = ${biz.id}`;
if (plan.plan_status !== "active" || plan.plan_amount_cents !== 2900 || plan.plan_interval !== "month") fail(`plan should be active monthly $29: ${JSON.stringify(plan)}`);
step("choose monthly → Stripe Checkout → webhook: active, US$29 a month; Manage billing opens Stripe's portal");

// The app owner's dashboard counts the revenue.
const admin = await (await browser.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
await admin.goto(`${BASE}/login`);
await admin.fill('input[name="email"]', "owner@example.com");
await admin.fill('input[name="password"]', "correct horse battery");
await admin.click('button[type="submit"]');
await admin.waitForURL(/\/today/);
await admin.goto(`${BASE}/admin`);
await admin.getByText(/\$\s?29/).first().waitFor();
step("the dashboard shows the monthly revenue (US$29)");

// Cancelled → the app opens only the plan page; the booking page pauses.
await webhook("customer.subscription.deleted", subscription("canceled"));
await page.goto(`${BASE}/today`);
await page.waitForURL(/\/billing/);
await page.getByText(/Your plan was cancelled/).waitFor();
const [{ booking_slug: slug }] = await db`select booking_slug from businesses where id = ${biz.id}`;
const visitor = await (await browser.newContext()).newPage();
await visitor.goto(`${BASE}/book/${slug}`);
await visitor.getByText("Online booking is paused").waitFor();
await shot("B02-plan-cancelled");
step("cancelled: the app opens only the plan page, and the booking page pauses");

// Stripe delivered an old "active" event late: the app reads the subscription and stays cancelled.
await webhook("customer.subscription.updated", subscription("active"), { stale: true });
const [{ plan_status: late }] = await db`select plan_status from businesses where id = ${biz.id}`;
if (late !== "cancelled") fail(`a late, out-of-order event should not reopen a cancelled plan (got ${late})`);
step("a late out-of-order event doesn't undo the cancellation");

// A trial that ended unpaid is locked the same way.
await db`update businesses set plan_status = 'trial', trial_ends_at = now() - interval '1 day' where id = ${biz.id}`;
await page.goto(`${BASE}/clients`);
await page.waitForURL(/\/billing/);
await page.getByText(/Your free trial has ended/).waitFor();
step("trial over without a plan: locked to the plan page (data kept)");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await db.end();
await browser.close();
console.log("billing: all good");
