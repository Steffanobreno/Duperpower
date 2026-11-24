// After the payment: a "Payment received" screen, end to end. Run after slice.mjs (Maria Lopez, Biscuit).
// Finish order → collect in cash with a tip → "Payment received" with the amount and the tip,
// the receipt to send, Book next visit, Client history, Back to Today and Edit order. The back
// arrow goes to Today, not back to the checkout. Edit order opens the checkout again. A partial
// payment stays on the checkout (nothing to celebrate yet).
// Usage: node tests/e2e/paid-screen.mjs [baseUrl]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
await page.goto(`${BASE}/clients?q=Maria`);
await page.getByRole("link", { name: /Maria/ }).first().click();
await page.waitForURL(/\/clients\/[0-9a-f-]+$/);
const clientId = page.url().split("/").pop();

const d = new Date();
d.setDate(d.getDate() + 8);
if (d.getDay() === 0) d.setDate(d.getDate() + 1);
const date = d.toISOString().slice(0, 10);
async function book(time) {
  await page.goto(`${BASE}/appointments/new?client=${clientId}&date=${date}&time=${time}`);
  const select = page.locator('select[name^="svc:"]');
  await select.selectOption(await select.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
  await page.getByRole("button", { name: "Book appointment" }).click();
  await page.waitForURL(/\?booked=1/);
  const url = page.url().split("?")[0];
  for (const label of ["I'm on the way", "Check in", "Finish order"]) {
    await page.getByRole("button", { name: label }).click();
    await page.waitForLoadState("networkidle");
  }
  await page.waitForURL(/\/checkout/);
  return url;
}

// A partial payment stays on the checkout.
const partialUrl = await book("15:00");
await page.getByRole("button", { name: "No tip" }).click();
await page.getByRole("button", { name: "Check out with Cash" }).click();
await page.getByLabel(/Amount/).first().fill("50");
await page.getByRole("button", { name: /^Charge \$50/ }).click();
await page.waitForLoadState("networkidle");
await page.getByRole("region", { name: "Collect payment" }).waitFor();
if (/\/paid/.test(page.url())) fail("a partial payment shouldn't open Payment received");
step("a partial payment stays on the checkout");

// Paid in full → Payment received.
const visitUrl = await book("09:00");
const id = visitUrl.split("/").pop();
await page.getByRole("button", { name: "$21.80 (20%)" }).click();
await page.getByRole("button", { name: "Check out with Cash" }).click();
await page.getByRole("button", { name: "Charge $130.80" }).click();
await page.waitForURL(new RegExp(`/appointments/${id}/paid`));
await page.getByRole("heading", { name: "Payment received" }).first().waitFor();
await page.getByText("$130.80").first().waitFor();
await page.getByText("incl. $21.80 tip").waitFor();
await page.getByText("Order finished · Paid in full. Thank you!").waitFor();
await page.getByRole("region", { name: "Receipt" }).waitFor();
for (const name of ["Book next visit", "Client history", "Back to Today", "Edit order", "See receipt"]) {
  await page.getByRole("link", { name }).waitFor();
}
await shot("PR01-payment-received");
step("paid in full: Payment received with the amount, the tip, the receipt and what to do next");

const book2 = await page.getByRole("link", { name: "Book next visit" }).getAttribute("href");
if (!book2.includes(`client=${clientId}`) || !book2.includes("pick=book")) fail(`Book next visit should open the calendar for Maria: ${book2}`);
const hist = await page.getByRole("link", { name: "Client history" }).getAttribute("href");
if (hist !== `/clients/${clientId}`) fail(`Client history should open Maria: ${hist}`);
step("Book next visit opens the calendar for the same client; Client history opens the client");

// The back arrow goes to Today, not back to the checkout.
await page.getByRole("link", { name: "Back", exact: true }).click();
await page.waitForURL(/\/today/);
step("the back arrow on Payment received goes to Today");

// Edit order opens the checkout again.
await page.goto(`${BASE}/appointments/${id}/paid`);
await page.getByRole("link", { name: "Edit order" }).click();
await page.waitForURL(new RegExp(`/appointments/${id}/checkout`));
await page.getByText("Order finished · Paid in full. Thank you!").waitFor();
step("Edit order opens the checkout");

// An unpaid visit has no Payment received screen: it goes to its checkout.
const partialId = partialUrl.split("/").pop();
await page.goto(`${BASE}/appointments/${partialId}/paid`);
await page.waitForURL(new RegExp(`/appointments/${partialId}/checkout`));
step("a visit not paid in full opens its checkout instead");

await browser.close();
if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
console.log("paid-screen: all good");
