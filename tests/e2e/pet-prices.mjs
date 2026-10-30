// A pet's own prices, end to end. Run after slice.mjs (Maria Lopez, 650-555-0142, pet Biscuit, medium).
// Set Biscuit's price and time for Bath - Medium → booking in the app uses them → the client
// sees and books that price online → removing it goes back to the usual price.
// Usage: node tests/e2e/pet-prices.mjs [baseUrl]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
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

await page.goto(`${BASE}/clients?q=Maria`);
await page.getByRole("link", { name: /Maria/ }).first().click();
await page.waitForURL(/\/clients\/[0-9a-f-]+$/);
const clientUrl = page.url();
const clientId = clientUrl.split("/").pop();

// Set Biscuit's own price: Bath - Medium at $135 and 150 minutes.
await page.getByRole("link", { name: /Biscuit/ }).first().click();
await page.getByRole("heading", { name: "Biscuit's prices" }).waitFor();
const prices = page.locator("#prices");
const bath = prices.locator('select[name="service_id"] option', { hasText: "Bath - Medium" });
await prices.locator('select[name="service_id"]').selectOption(await bath.getAttribute("value"));
await prices.locator('input[name="price"]').fill("135");
await prices.locator('input[name="minutes"]').fill("150");
await prices.getByRole("button", { name: "Save price" }).click();
await prices.getByText("$135.00").waitFor();
await prices.getByText(/Usually \$109\.00 · 2h 30min for Biscuit/).waitFor();
await page.goto(clientUrl);
await page.getByText("1 price just for Biscuit").waitFor();
step("Biscuit's own price saved ($135, 2h 30min) and shown on the client");

// Booking in the app picks it up, in the list and on the visit.
const d = new Date();
d.setDate(d.getDate() + 5);
if (d.getDay() === 0) d.setDate(d.getDate() + 1);
const date = d.toISOString().slice(0, 10);
await page.goto(`${BASE}/appointments/new?client=${clientId}&date=${date}&time=09:00`);
const select = page.locator('select[name^="svc:"]');
const option = select.locator("option", { hasText: "Bath - Medium" });
if (!(await option.textContent()).includes("$135.00 (Biscuit's price)")) fail("the booking list doesn't show Biscuit's price");
await select.selectOption(await option.getAttribute("value"));
await page.getByRole("button", { name: "Book appointment" }).click();
await page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/);
await page.getByText("9:00 AM – 11:30 AM · 2h 30min").waitFor();
await page.getByText("$135.00").first().waitFor();
step("booking in the app charges $135 and blocks 2h 30min");

// Online, Maria sees Biscuit's price.
const client = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
client.on("pageerror", (e) => errors.push(e.message));
await client.goto(`${BASE}/book`);
await client.getByLabel("Mobile phone").fill("650-555-0142");
await client.getByRole("button", { name: "Next", exact: true }).click();
await client.getByText("Welcome back, Maria!").waitFor();
await client.getByRole("button", { name: "Continue", exact: true }).click();
await client.getByRole("button", { name: "Continue to service", exact: true }).click();
const onlineBath = client.getByRole("radiogroup", { name: "Service" }).getByRole("radio", { name: /Bath - Medium/ });
await onlineBath.waitFor();
if (!(await onlineBath.textContent()).includes("$135")) fail("the booking page doesn't show Biscuit's price");
step("online booking shows Maria Biscuit's $135 price");

// Removing the price goes back to the usual one.
await page.goto(clientUrl);
await page.getByRole("link", { name: /Biscuit/ }).first().click();
await page.getByRole("button", { name: "Remove Biscuit's price for Bath - Medium" }).click();
await page.locator("#prices").getByText("$135.00").waitFor({ state: "detached" });
await page.goto(`${BASE}/appointments/new?client=${clientId}&date=${date}&time=14:00`);
const again = await page.locator('select[name^="svc:"] option', { hasText: "Bath - Medium" }).textContent();
if (!again.includes("$109.00") || again.includes("Biscuit's price")) fail("removing the price didn't restore the usual one");
step("removing Biscuit's price goes back to the usual $109");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
