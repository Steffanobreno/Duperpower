// Finishing an order without the steps, end to end. Run after slice.mjs (Maria Lopez), with
// DATABASE_URL. A visit still "not confirmed" → "Finish order" next to "I'm on the way" →
// straight to the checkout; the visit is done and has a check-in time.
// Usage: node tests/e2e/finish-direct.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = postgres(process.env.DATABASE_URL);
const [{ client }] = await db`select id as client from clients where first_name = 'Maria'`;
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

const date = new Date(Date.now() + 3 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
await page.goto(`${BASE}/appointments/new?client=${client}&date=${date}&time=14:00`);
const sel = page.locator('select[name^="svc:"]');
await sel.selectOption(await sel.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
await page.getByLabel(/Send the confirmation/).uncheck();
await page.getByRole("button", { name: "Book appointment" }).click();
await page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/);
const id = page.url().split("/").pop().split("?")[0];

await page.getByRole("button", { name: "I'm on the way" }).waitFor();
await page.getByRole("button", { name: "Finish order" }).click();
await page.waitForURL(/\/checkout/);
await page.getByText(/Collect payment|Finish order/).first().waitFor();
const [a] = await db`select status, checked_in_at, checked_out_at from appointments where id = ${id}`;
if (a.status !== "completed") fail(`status should be completed, is ${a.status}`);
if (!a.checked_in_at || !a.checked_out_at) fail("check-in and check-out times should be filled");
step("a visit not yet confirmed goes straight to the checkout with “Finish order”");

// The status menu offers it too.
await page.goto(`${BASE}/appointments/new?client=${client}&date=${date}&time=17:00`);
await sel.selectOption(await sel.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
await page.getByLabel(/Send the confirmation/).uncheck();
await page.getByRole("button", { name: "Book appointment" }).click();
await page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/);
await page.getByText("Finish order (skip the steps)").waitFor({ state: "attached" });
step("the status menu has “Finish order (skip the steps)”");

await db.end();
await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
