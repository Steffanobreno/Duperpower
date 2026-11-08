// Discount codes and referrals, end to end, against the fake Stripe (STRIPE_API_BASE) with
// STRIPE_WEBHOOK_SECRET=whsec_test and ADMIN_EMAILS=owner@example.com on the server. Run after slice.mjs.
// Admin makes a code → a groomer's plan page shows their referral link → a new groomer signs up
// with it (invited notice) → their Checkout gets the free first month → a typed discount code
// goes to Checkout, a wrong or own code is refused → the referrer gets US$29 credit once, only
// when the referred groomer pays a real bill → the admin sees it all, the funnel and the errors page.
// Usage: node tests/e2e/discounts.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";
import Stripe from "stripe";

const BASE = process.argv[2] ?? "http://localhost:3000";
const STRIPE_API = process.env.STRIPE_API_BASE ?? "http://127.0.0.1:4546";
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
const newPage = async (width = 390) => {
  const p = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
};
const lastStripe = async (path) => (await fetch(`${STRIPE_API}/__last?path=${encodeURIComponent(path)}`)).json();
const balance = async () => (await fetch(`${STRIPE_API}/__balance`)).json();
async function webhook(type, object) {
  const payload = JSON.stringify({ id: `evt_${Date.now()}`, object: "event", type, data: { object }, api_version: "2026-09-30.endive" });
  const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret: "whsec_test" });
  const res = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", body: payload, headers: { "stripe-signature": header, "content-type": "application/json" } });
  if (!res.ok) fail(`webhook ${type} → ${res.status}`);
}
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
// Checkout sends straight back to APP_URL (maybe another host name in tests): wait, then come back.
async function choose(page, plan, code = "") {
  await page.goto(`${BASE}/billing`);
  await page.getByLabel("Discount or referral code (optional)").fill(code);
  await page.getByLabel(/I have read and accept the Terms/).check();
  await page.getByRole("button", { name: plan }).click();
  await page.waitForURL(/done=1|login|code_error|error=1/);
  return page.url();
}

// 1. The app owner makes a discount code in /admin.
const admin = await newPage(1100);
await admin.goto(`${BASE}/login`);
await admin.fill('input[name="email"]', "owner@example.com");
await admin.fill('input[name="password"]', "correct horse battery");
await admin.click('button[type="submit"]');
await admin.waitForURL(/\/today/);
await admin.goto(`${BASE}/admin/codes`);
await admin.fill('input[name="code"]', "ABC-1234");
await admin.fill('input[name="value"]', "50");
await admin.getByRole("button", { name: "Criar código" }).click();
await admin.getByText(/formato \(LETRAS-1234\) é dos códigos de indicação/).waitFor();
await admin.fill('input[name="code"]', "launch50");
await admin.getByRole("button", { name: "Criar código" }).click();
await admin.getByText("Código criado.").waitFor();
await admin.reload();
await admin.getByText("LAUNCH50").waitFor();
await admin.getByText(/50% · 1ª cobrança/).waitFor();
const coupon = await lastStripe("/v1/coupons");
if (coupon?.percent_off !== "50" || coupon?.duration !== "once") fail(`the coupon should be 50% once: ${JSON.stringify(coupon)}`);
step("admin: a discount code is made in Stripe (a referral-like code is refused)");

// 2. A groomer's plan page has their referral link and code.
const a = await newPage();
const aId = await signUp(a, "Sudsy Mobile Spa", `ref-a${stamp}@example.com`);
await a.goto(`${BASE}/billing`);
await a.getByText(/^Refer a groomer: you both save (US)?\$29$/).waitFor();
const code = await a.getByLabel("Your referral code").inputValue();
if (!/^[A-Z]+-\d{4}$/.test(code)) fail(`referral code looks wrong: ${code}`);
const link = await a.getByLabel("Your referral link").inputValue();
if (!link.endsWith(`/signup?ref=${code}`)) fail(`referral link looks wrong: ${link}`);
step(`a groomer's plan page shows their referral link and code (${code})`);

// 3. A new groomer signs up with the link: invited notice, referral noted, free first month at Checkout.
const b = await newPage();
await b.goto(`${BASE}/signup?ref=${code}`);
await b.getByText("Invited by Sudsy Mobile Spa: your first month is free when you choose a plan.").waitFor();
const bId = await signUp(b, "Bubbly Paws", `ref-b${stamp}@example.com`, `/signup?ref=${code}`);
const [ref] = await db`select referrer_id from referrals where referred_id = ${bId}`;
if (ref?.referrer_id !== aId) fail("signing up with the referral link should note the referral");
// Their own code is refused.
await b.goto(`${BASE}/billing`);
const own = await b.getByLabel("Your referral code").inputValue();
if (!(await choose(b, "Choose monthly", own)).includes("code_error=own")) fail("their own code should be refused");
await b.getByText("That's your own referral code: share it with other groomers.").waitFor();
await choose(b, "Choose monthly");
const bCheckout = await lastStripe("/v1/checkout/sessions");
if (bCheckout?.["discounts[0][coupon]"] !== "fino-referral-month") fail(`the referred groomer's Checkout should get the referral coupon: ${JSON.stringify(bCheckout)}`);
const refCoupon = await (await fetch(`${STRIPE_API}/v1/coupons/fino-referral-month`)).json();
if (refCoupon.amount_off !== "2900" || refCoupon.duration !== "once") fail(`the referral coupon should be US$29 once: ${JSON.stringify(refCoupon)}`);
step("signing up with the link: invited notice, referral noted, Checkout gets the free first month; their own code is refused");

// 4. Another groomer types the discount code (any letter case); a wrong one is refused.
const c = await newPage();
await signUp(c, "Clean Coats", `ref-c${stamp}@example.com`);
if (!(await choose(c, "Choose yearly", "NOPE-CODE")).includes("code_error=bad")) fail("a wrong code should be refused");
await c.getByText("That code doesn't exist or has expired.").waitFor();
await choose(c, "Choose yearly", "launch50");
const cCheckout = await lastStripe("/v1/checkout/sessions");
const [{ stripe_promotion_code_id: promoId }] = await db`select stripe_promotion_code_id from discount_codes where code = 'LAUNCH50'`;
if (cCheckout?.["discounts[0][promotion_code]"] !== promoId || cCheckout["allow_promotion_codes"]) fail(`the typed code should go to Checkout: ${JSON.stringify(cCheckout)}`);
step("a typed discount code goes to Checkout; a wrong code is refused");

// 5. The referrer's credit: not for a US$0 bill (the free month), once for the first real one.
const [{ stripe_customer_id: bCustomer }] = await db`select stripe_customer_id from businesses where id = ${bId}`;
const before = (await balance()).length;
await webhook("invoice.paid", { id: "in_free", object: "invoice", customer: bCustomer, amount_paid: 0 });
if ((await balance()).length !== before) fail("a US$0 bill (the free month) shouldn't give the referrer credit");
await webhook("invoice.paid", { id: "in_1", object: "invoice", customer: bCustomer, amount_paid: 2900 });
await webhook("invoice.paid", { id: "in_2", object: "invoice", customer: bCustomer, amount_paid: 2900 });
const credits = (await balance()).slice(before);
const [{ stripe_customer_id: aCustomer }] = await db`select stripe_customer_id from businesses where id = ${aId}`;
if (credits.length !== 1 || credits[0].amount !== -2900 || credits[0].customer !== aCustomer) fail(`the referrer should get one US$29 credit: ${JSON.stringify(credits)}`);
await a.goto(`${BASE}/billing`);
await a.getByText(/1 joined with your code · \$29 in credit so far/).waitFor();
step("the referrer gets US$29 credit once, when the referred groomer pays a real bill; their plan page shows it");

// 6. The admin sees the referral, can turn the code off, and has the funnel and the errors page.
await admin.goto(`${BASE}/admin/codes`);
await admin.getByText(/Sudsy Mobile Spa/).first().waitFor();
await admin.getByText(/crédito dado em/).waitFor();
await admin.getByRole("button", { name: "Desativar" }).click();
await admin.getByText("desativado").waitFor();
if (!(await choose(c, "Choose yearly", "LAUNCH50")).includes("code_error=bad")) fail("a turned-off code should be refused");
await admin.goto(`${BASE}/admin`);
await admin.getByText("Funil dos cadastros (últimos 30 dias)").waitFor();
await admin.getByText("Marcaram a 1ª visita").waitFor();
await admin.goto(`${BASE}/admin/errors`);
await admin.getByRole("heading", { name: "Erros no servidor" }).waitFor();
step("admin: referrals with their credit, turning a code off, the signup funnel and the errors page");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await db.end();
await browser.close();
console.log("discounts: all good");
