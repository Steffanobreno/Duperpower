// Sizing dogs by weight, in kilos, end to end. Run after slice.mjs (owner@example.com, US).
// Settings → Business: sizes by weight, kg · a pet weighed 15 kg becomes Medium · the services
// and the booking page show the weight bands · back to height and pounds.
// Usage: node tests/e2e/units.mjs [baseUrl] [screenshotDir]
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
const shot = (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const units = async (sizeBy, weight, height) => {
  await page.goto(`${BASE}/settings/business`);
  await page.getByLabel("Sort dogs into sizes by").selectOption(sizeBy);
  await page.getByLabel("Weight in").selectOption(weight);
  await page.getByLabel("Height in").selectOption(height);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Saved.").waitFor();
};

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

await units("weight", "kg", "in");
step("Settings → Business: sizes by weight, in kilos");

// A new pet weighed 15 kg: the size follows the weight.
await page.goto(`${BASE}/clients/new`);
await page.getByLabel("First name").fill("Kilo");
await page.getByLabel("Last name").fill("Test");
await page.getByLabel("Mobile phone").fill("(650) 555-0177");
await page.getByRole("button", { name: /Save/ }).first().click();
await page.waitForURL(/\/pets\/new/);
if (!(await page.getByRole("option", { name: "Medium (10–22 kg)" }).count())) fail("sizes should be weight bands in kg");
await page.getByLabel("Pet name").fill("Pluma");
await page.getByLabel("Weight (kg)").fill("15");
await page.getByRole("button", { name: "Save pet" }).click();
await page.waitForURL(/\/clients\/[0-9a-f-]+$/);
await page.getByText(/Medium \(10–22 kg\)/).first().waitFor();
step("a 15 kg pet is sized Medium (10–22 kg) on its own");

// The booking page offers the weight bands.
await page.goto(`${BASE}/book`);
const button = (name) => page.getByRole("button", { name, exact: true });
await page.getByLabel("Mobile phone").fill("(650) 555-0199");
await button("Next").click();
await page.getByLabel("First name").fill("Ana");
await page.getByLabel("Last name").fill("Silva");
await page.getByLabel("Email").fill("ana@example.com");
await button("Continue").click();
await page.getByLabel("Street address").fill("1 Main St");
await page.getByLabel("City").fill("San Mateo");
await page.getByLabel("ZIP code").fill("94401");
await button("Continue").click();
await page.getByText("By your dog's weight.").waitFor();
await page.getByRole("radio", { name: /up to 9 kg/ }).first().waitFor();
await shot("U01-book-weight");
step("booking page: sizes by weight in kg");

await units("height", "lb", "in");
await page.goto(`${BASE}/clients/new`);
await page.getByLabel("First name").waitFor();
step("back to height and pounds");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("units: all good");
