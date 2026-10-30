// Calendar look, end to end. Run after slice.mjs (Maria Lopez's visit at 10:00 on VISIT_DATE).
// Hide the client name and address → the day view shows the pet instead · set the hours shown ·
// color by groomer and by service.
// Usage: VISIT_DATE=yyyy-mm-dd node tests/e2e/calendar-look.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const DATE = process.env.VISIT_DATE;
if (!DATE) throw new Error("Set VISIT_DATE");
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

const visit = () => page.locator('section[aria-label="Day schedule"] a[href^="/appointments/"]').first();
const day = `${BASE}/calendar?view=day&date=${DATE}`;
await page.goto(day);
await visit().getByText("Maria Lopez").waitFor();
const firstHour = async () => (await page.locator('section[aria-label="Day schedule"] .card > button span').first().textContent()).trim();

const save = async (fill) => {
  await page.goto(`${BASE}/settings/calendar-view`);
  await fill();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Saved.").waitFor();
};

await save(async () => {
  await page.getByLabel("Client name").uncheck();
  await page.getByLabel("Address").uncheck();
  await page.getByLabel("Day view starts at").fill("06:00");
  await page.getByLabel("Day view ends at").fill("21:00");
});
await page.goto(day);
await visit().getByText("Biscuit").first().waitFor();
if (await visit().getByText("Maria Lopez").count()) fail("the client name should be hidden");
if ((await firstHour()) !== "6 AM") fail(`day should start at 6 AM, starts at ${await firstHour()}`);
if (SHOTS) await page.screenshot({ path: `${SHOTS}/C01-calendar-look.png`, fullPage: true });
step("hiding the client name and address; the day view starts at 6 AM");

await save(async () => {
  await page.getByLabel("Color the visits by").selectOption("staff");
});
await page.goto(day);
const staffColor = await visit().evaluate((el) => getComputedStyle(el).borderLeftColor);
await page.goto(`${BASE}/settings/services`);
await page.locator('a[href^="/settings/services/"]', { hasText: /Full Haircut.*Medium/ }).first().click();
await page.getByLabel("Calendar color").fill("#ff0000");
await page.getByRole("button", { name: "Save" }).click();
await page.waitForURL(/\/settings\/services$/);
await save(async () => {
  await page.getByLabel("Color the visits by").selectOption("service");
  await page.getByLabel("Client name").check();
});
await page.goto(day);
await visit().getByText("Maria Lopez").waitFor();
const serviceColor = await visit().evaluate((el) => getComputedStyle(el).borderLeftColor);
if (serviceColor !== "rgb(255, 0, 0)") fail(`should be the service's red, is ${serviceColor}`);
if (staffColor === serviceColor) fail(`colors should change: ${staffColor} vs ${serviceColor}`);
step(`colored by groomer (${staffColor}), then by service (${serviceColor})`);

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
