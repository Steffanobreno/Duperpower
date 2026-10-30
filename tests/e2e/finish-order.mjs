// Finishing an order, end to end. Run after slice.mjs (Maria Lopez, pet Biscuit).
// Finish order → change a price and add a service on the bill → collect payment → order finished;
// add a service after it was paid → the bill asks for the rest → collect it; a $0 visit finishes
// without a charge; "pay later" leaves it unpaid.
// Usage: node tests/e2e/finish-order.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const step = (msg) => console.log(`✓ ${msg}`);
const shot = (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

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
d.setDate(d.getDate() + 6);
if (d.getDay() === 0) d.setDate(d.getDate() + 1);
const date = d.toISOString().slice(0, 10);

async function book(time) {
  await page.goto(`${BASE}/appointments/new?client=${clientId}&date=${date}&time=${time}`);
  const select = page.locator('select[name^="svc:"]');
  await select.selectOption(await select.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
  await page.getByRole("button", { name: "Book appointment" }).click();
  await page.waitForURL(/\?booked=1/);
  return page.url().split("?")[0];
}
async function runTheDay() {
  for (const label of ["I'm on the way", "Check in", "Finish order"]) {
    await page.getByRole("button", { name: label }).click();
    await page.waitForLoadState("networkidle");
  }
  await page.waitForURL(/\/checkout/);
}
async function setFirstPrice(dollars) {
  const price = page.getByLabel(/^Price of /).first();
  await price.fill(String(dollars));
}

// 1. Finish order → edit price and add a service on the way to payment.
const apptUrl = await book("09:00");
await runTheDay();
await page.getByRole("heading", { name: "Finish order" }).waitFor();
await shot("F01-finish-order");
await page.getByRole("link", { name: "Edit services & prices" }).click();
await page.getByText("Changes update this visit's bill.").waitFor();
await setFirstPrice(120);
const add = page.getByLabel("Add a service for Biscuit");
await add.selectOption(await add.locator("option", { hasText: "De-shedding" }).getAttribute("value"));
await page.getByRole("button", { name: "Save changes" }).click();
await page.waitForURL(apptUrl);
await page.getByRole("link", { name: /Collect payment \$165\.00/ }).click();
await page.getByText("Biscuit").first().waitFor();
await page.getByText("$120.00").first().waitFor();
step("at checkout the price changed to $120 and De-shedding was added: $165 to collect");

// 2. Collect: no tip, cash → order finished.
await page.getByRole("button", { name: "No tip" }).click();
await page.getByRole("button", { name: "Check out with Cash" }).click();
await page.getByRole("button", { name: "Charge $165.00" }).click();
await page.getByText("Order finished · Paid in full. Thank you!").waitFor();
await shot("F02-order-finished");
step("collected $165 in cash: order finished");

// 3. Add a service after it was paid: the bill asks for the rest.
await page.goto(apptUrl);
await page.getByRole("link", { name: "Edit services" }).first().click();
await page.getByText(/This visit is paid/).waitFor();
const add2 = page.getByLabel("Add a service for Biscuit");
await add2.selectOption(await add2.locator("option", { hasText: "Nail painting" }).getAttribute("value"));
await page.getByRole("button", { name: "Save changes" }).click();
await page.waitForURL(apptUrl);
await page.getByRole("link", { name: /Collect payment \$15\.00/ }).click();
await page.getByRole("button", { name: "No tip" }).click();
await page.getByRole("button", { name: "Zelle" }).click();
await page.getByRole("button", { name: "Charge $15.00" }).click();
await page.getByText("Order finished · Paid in full. Thank you!").waitFor();
step("added Nail painting after paying: collected the extra $15 by Zelle");

// 4. A free visit finishes without a charge.
const freeUrl = await book("13:00");
await page.getByRole("link", { name: "Edit services" }).first().click();
await setFirstPrice(0);
await page.getByRole("button", { name: "Save changes" }).click();
await page.waitForURL(freeUrl);
await runTheDay();
await page.getByRole("button", { name: "Finish order (nothing to charge)" }).click();
await page.getByText("Order finished · Paid in full. Thank you!").waitFor();
step("a $0 visit finishes with no charge");

// 5. Pay later leaves it unpaid.
await book("16:00");
await runTheDay();
await page.getByRole("link", { name: "The client will pay later (leave it unpaid)" }).click();
await page.getByText("UNPAID").waitFor();
await page.getByRole("link", { name: /Collect payment \$109\.00/ }).waitFor();
step("'pay later' leaves the finished visit unpaid, with Collect payment ready");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
