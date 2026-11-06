// Quick add, end to end. Run after slice.mjs (owner@example.com).
// New client with their pet on one screen → the client page with the pet · the rare fields are
// folded under "More details" · without a pet name it still goes on to the pet form.
// Usage: node tests/e2e/quick-add.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
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

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

await page.goto(`${BASE}/clients/new`);
if (await page.getByLabel("Parking and access notes").isVisible()) fail("the rare fields should be folded on a new client");
await page.getByLabel("First name").fill("Quick");
await page.getByLabel("Last name").fill("Add");
await page.getByLabel("Mobile phone").fill("(650) 555-0161");
await page.getByLabel("Pet name").fill("Biscotti");
await page.getByLabel("Size").selectOption("medium");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/Q01-quick-add.png`, fullPage: true });
await page.getByRole("button", { name: "Save client and pet" }).click();
await page.waitForURL(/\/clients\/[0-9a-f-]+$/);
await page.getByRole("link", { name: /Biscotti/ }).first().waitFor();
step("client and pet on one screen → the client page with Biscotti");

await page.goto(`${BASE}/clients/new`);
await page.getByLabel("First name").fill("No");
await page.getByLabel("Last name").fill("Pet");
await page.getByLabel("Mobile phone").fill("(650) 555-0162");
await page.getByText("More details (optional)").click();
await page.getByLabel("Parking and access notes").fill("Gate 1234");
await page.getByRole("button", { name: "Save and add a pet" }).click();
await page.waitForURL(/\/pets\/new/);
step("without a pet name: on to the pet form, and More details opens the extra fields");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("quick-add: all good");
