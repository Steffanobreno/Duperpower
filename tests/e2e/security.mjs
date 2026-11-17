// Security basics, end to end: the protective headers on every kind of page (Content-Security-
// Policy, HSTS, no MIME sniffing, Referer kept private, framing only where allowed), no page
// breaking that policy, the private areas closed to visitors, the hourly job closed without its
// secret, a wrong upload refused, and the per-visitor limits shared through the database (a
// visitor from one IP is stopped after too many tries; another IP is not).
// Run after slice.mjs. Needs DATABASE_URL. Usage: node tests/e2e/security.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = postgres(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/woofers", { max: 1 });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

// 1. Headers on the site, the app, the booking page and an API route.
for (const path of ["/", "/pricing", "/login", "/book/woofers", "/today", "/api/cron/messages"]) {
  const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
  const h = (k) => r.headers.get(k) ?? "";
  const csp = h("content-security-policy");
  for (const rule of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors"]) {
    if (!csp.includes(rule)) fail(`${path}: the Content-Security-Policy misses ${rule}: ${csp}`);
  }
  if (!/^max-age=\d{8,}/.test(h("strict-transport-security"))) fail(`${path}: no HSTS`);
  if (h("x-content-type-options") !== "nosniff") fail(`${path}: no nosniff`);
  if (h("referrer-policy") !== "strict-origin-when-cross-origin") fail(`${path}: Referrer-Policy ${h("referrer-policy")}`);
  if (!h("cross-origin-opener-policy")) fail(`${path}: no Cross-Origin-Opener-Policy`);
  if (h("x-powered-by")) fail(`${path}: X-Powered-By tells the framework`);
  if (h("access-control-allow-origin")) fail(`${path}: no other site may read this (CORS ${h("access-control-allow-origin")})`);
}
// Only the booking link may be shown inside another site.
const framing = async (path) => (await fetch(`${BASE}${path}`, { redirect: "manual" })).headers.get("content-security-policy").match(/frame-ancestors ([^;]+)/)[1];
if ((await framing("/today")).trim() !== "'self'") fail("the app must not be shown inside other sites");
if (!(await framing("/book")).includes("https://woofersdogspa.com")) fail("the booking link may be shown on the business website");
step("headers: CSP, HSTS, nosniff, Referrer-Policy, COOP on every kind of page; no CORS, no X-Powered-By; framing only for the booking link");

// 2. No page breaks the policy (a blocked script, style or picture shows up as a console error).
const violations = [];
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on("console", (m) => m.type() === "error" && /Content Security Policy|Refused to/.test(m.text()) && violations.push(`${page.url()}: ${m.text()}`));
for (const path of ["/", "/features", "/book/woofers", "/intake", "/login"]) await page.goto(`${BASE}${path}`, { waitUntil: "load" });
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
for (const path of ["/today", "/calendar", "/clients", "/settings/business", "/settings/areas", "/settings/booking", "/billing"]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await page.waitForTimeout(300);
}
if (violations.length) fail(`pages break the Content-Security-Policy:\n${violations.join("\n")}`);
step("no page breaks the policy (site, booking, intake, login and the app's main screens)");

// 3. Private areas: the app sends visitors to the login; the admin is a 404 for groomers; the
// hourly job and the exports need their keys.
const today = await fetch(`${BASE}/today`, { redirect: "manual" });
if (![303, 307, 302].includes(today.status) || !/\/login/.test(today.headers.get("location") ?? "")) fail(`/today without a login → ${today.status}`);
for (const path of ["/api/export/clients", "/api/export/backup", "/api/device/outbox", "/api/device/backup"]) {
  const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
  if (r.status === 200) fail(`${path} answered without a login or key`);
}
for (const auth of [undefined, "Bearer wrong", "Bearer test-cron-but-longer"]) {
  const r = await fetch(`${BASE}/api/cron/messages`, { headers: auth ? { authorization: auth } : {} });
  if (r.status !== 401) fail(`the hourly job with ${auth ?? "no key"} → ${r.status}`);
}
const webhook = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", body: "{}", headers: { "stripe-signature": "t=1,v1=bad" } });
if (webhook.status !== 400) fail(`a Stripe webhook with a bad signature → ${webhook.status}`);
step("private areas: login required, exports and device links need their key, the hourly job its secret, Stripe its signature");

// 4. An upload that isn't a picture is refused, whatever its name says (the phone can't read it;
// the server checks the first bytes too, in lib/pet-photos.ts sniff()).
await page.goto(`${BASE}/settings/business`);
await page.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from("<script>alert(1)</script>") });
await page.getByText(/Use a PNG or JPEG picture|Could not read that picture/).waitFor();
if (await page.locator('img[alt="Business logo"][src^="/logo/"]').count()) fail("a fake picture became the logo");
step("an upload that isn't really a picture is refused");

// 5. Shared per-visitor limits: 10 password-reset tries an hour from one IP, counted in the database.
const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;
await db`delete from rate_hits where key like ${`forgot:${ip}`}`;
const visitor = await (await browser.newContext({ extraHTTPHeaders: { "x-nf-client-connection-ip": ip } })).newPage();
let stopped = 0;
for (let i = 0; i < 11; i++) {
  await visitor.goto(`${BASE}/login/forgot`);
  await visitor.fill('input[name="email"]', `nobody${i}@example.com`);
  await visitor.getByRole("button", { name: "Send me the link" }).click();
  await visitor.getByText(/Too many wrong tries|If an account|check your email|sent/i).first().waitFor();
  if (await visitor.getByText(/Too many wrong tries/).count()) stopped = i + 1;
}
if (stopped !== 11) fail(`the 11th try from one IP should be stopped (stopped at ${stopped})`);
const [{ n }] = await db`select count(*)::int as n from rate_hits where key = ${`forgot:${ip}`}`;
if (n !== 11) fail(`the tries should be counted in the database (${n})`);
const other = await (await browser.newContext({ extraHTTPHeaders: { "x-nf-client-connection-ip": "198.51.100.9" } })).newPage();
await db`delete from rate_hits where key = 'forgot:198.51.100.9'`;
await other.goto(`${BASE}/login/forgot`);
await other.fill('input[name="email"]', "someone@example.com");
await other.getByRole("button", { name: "Send me the link" }).click();
await other.waitForTimeout(800);
if (await other.getByText(/Too many wrong tries/).count()) fail("another visitor should not be stopped");
step("per-visitor limits are counted in the database: the 11th password-reset try from one IP is stopped, another IP isn't");

await db.end();
await browser.close();
console.log("security: all good");
