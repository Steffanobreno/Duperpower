// Email through Resend, end to end, against the fake Resend server (dev server started with
// RESEND_API_KEY=test-resend, EMAIL_FROM, RESEND_API_URL and GMAIL_USER). Run after slice.mjs
// (Maria's paid visit), with DATABASE_URL. RESEND_LOG = the fake's log file.
// Usage: RESEND_LOG=... node tests/e2e/email-provider.mjs [baseUrl]
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const LOG = process.env.RESEND_LOG;
if (!LOG) throw new Error("Set RESEND_LOG");
const sent = () => readFileSync(LOG, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

// Maria's paid visit: email her the receipt.
const db = postgres(process.env.DATABASE_URL);
await db`update clients set email = 'maria@example.com' where first_name = 'Maria'`;
await db.end();
await page.goto(`${BASE}/receipts`);
await page.locator('a[href*="/checkout"]').first().click();
await page.getByRole("button", { name: /Email receipt|Email again/ }).click();
let receipt;
for (let i = 0; i < 50 && !receipt; i++) {
  receipt = sent().find((m) => /receipt/i.test(m.subject));
  if (!receipt) await page.waitForTimeout(200);
}
if (!receipt) fail(`no receipt email: ${JSON.stringify(sent())}`);
if (receipt.from !== "Woofers Dog Spa <hello@woofersdogspa.com>") fail(`from: ${receipt.from}`);
if (receipt.reply_to !== "steffanogroomer@gmail.com") fail(`reply-to: ${receipt.reply_to}`);
if (!receipt.attachments.some((a) => a.endsWith(".pdf"))) fail("the receipt PDF should be attached");
step("receipt sent through Resend from hello@woofersdogspa.com, replies to Gmail, PDF attached");

await page.goto(`${BASE}/settings/messages`);
await page.getByText("Messages go out from hello@woofersdogspa.com (through Resend).").waitFor();
const before = sent().length;
await page.getByRole("button", { name: /test email/i }).click();
for (let i = 0; i < 50 && sent().length === before; i++) await page.waitForTimeout(200);
if (sent().length !== before + 1) fail("the test email should go through Resend");
step("settings show Resend; the test email goes through it");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
