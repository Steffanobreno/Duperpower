// Basic settings, end to end. Run after slice.mjs (owner@example.com).
// Settings search · account (name, password, other devices) · business profile and logo
// (on the booking page and receipts) · closed dates and holidays on Today and the calendar.
// Needs DATABASE_URL to read a receipt link. Usage: node tests/e2e/settings-basic.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";
import postgres from "postgres";

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
const newPage = async () => {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  return p;
};
const shot = (p, name) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const login = async (p, password) => {
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', "owner@example.com");
  await p.fill('input[name="password"]', password);
  await p.click('button[type="submit"]');
};
const day = (n) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

const page = await newPage();
await login(page, "correct horse battery");
await page.waitForURL(/\/today/);

// Settings: grouped, and the search box narrows it.
await page.goto(`${BASE}/settings`);
await page.getByRole("heading", { name: "Basic settings" }).waitFor();
await page.getByRole("heading", { name: "Communication" }).waitFor();
await shot(page, "S01-settings");
await page.getByPlaceholder("Search settings").fill("holiday");
await page.getByRole("link", { name: /Closed dates and holidays/ }).waitFor();
if (await page.getByRole("link", { name: /Services and prices/ }).count()) fail("search should hide other settings");
step("settings are grouped and the search finds “holiday”");

// Account: a second device gets logged out when the password changes.
const other = await newPage();
await login(other, "correct horse battery");
await other.waitForURL(/\/today/);
await page.goto(`${BASE}/settings/account`);
await page.getByLabel("Your name").fill("Steffano M");
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.getByText("Saved.").waitFor();
await page.getByLabel("Current password").fill("wrong password!!");
await page.locator('input[name="password"]').fill("a brand new password");
await page.getByLabel("New password again").fill("a brand new password");
await page.getByRole("button", { name: "Change password" }).click();
await page.getByText("Your current password is not right.").waitFor();
await page.getByRole("button", { name: "OK" }).click();
await page.getByLabel("Current password").fill("correct horse battery");
await page.getByRole("button", { name: "Change password" }).click();
await page.getByText(/Password changed/).waitFor();
await other.goto(`${BASE}/today`);
await other.waitForURL(/\/login/);
await login(other, "a brand new password");
await other.waitForURL(/\/today/);
// Put it back for the other tests.
await page.getByLabel("Current password").fill("a brand new password");
await page.locator('input[name="password"]').fill("correct horse battery");
await page.getByLabel("New password again").fill("correct horse battery");
await page.getByRole("button", { name: "Change password" }).click();
await page.getByText(/Password changed/).waitFor();
step("account: name saved; a wrong current password is refused; changing it logs out the other device");

// Business profile and logo.
await page.goto(`${BASE}/settings/business`);
await page.getByLabel("Street").fill("123 Main St");
await page.getByLabel("City").fill("San Mateo");
await page.getByLabel("ZIP").fill("94401");
await page.getByLabel("Instagram").fill("instagram.com/woofers");
if (await page.getByLabel("Instagram").evaluate((el) => el.validity.valid)) fail("a link without https:// should be refused");
await page.getByLabel("Instagram").fill("https://instagram.com/woofersdogspa");
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.getByText("Saved.").waitFor();
await page.getByLabel("Logo picture").setInputFiles("src/app/icon.png");
await page.getByRole("button", { name: "Change logo" }).waitFor();
const logoSrc = await page.getByAltText("Business logo").getAttribute("src");
if (!/^\/logo\/[0-9a-f-]{36}\?v=\d+$/.test(logoSrc)) fail(`logo not saved: ${logoSrc}`);
await shot(page, "S02-business");
const client = await newPage();
await client.goto(`${BASE}/book`);
if ((await client.locator(`header img[src="${logoSrc}"]`).count()) !== 1) fail("the booking page should show the new logo");
const logo = await client.request.get(`${BASE}${logoSrc}`);
if (logo.headers()["content-type"] !== "image/png") fail("the logo should be served as PNG");
const db = postgres(process.env.DATABASE_URL);
const [bill] = await db`select public_token from invoices where status = 'closed' order by receipt_no limit 1`;
await db.end();
await client.goto(`${BASE}/r/${bill.public_token}`);
await client.getByText(/123 Main St, San Mateo, CA 94401/).waitFor();
if ((await client.locator(`img[src="${logoSrc}"]`).count()) < 2) fail("the receipt should show the logo in the header and on the receipt");
step("business profile: links are checked, address shows on receipts, the logo shows on the booking page");

// Closed dates and holidays.
await page.goto(`${BASE}/settings/closed`);
await page.getByLabel("First day").fill(day(3));
await page.getByLabel("Last day").fill(day(4));
await page.locator('input[name="reason"]').fill("Vacation");
await page.getByRole("button", { name: "Add closed dates" }).click();
await page.getByText("Added.").waitFor();
await page.getByLabel("Closed on Thanksgiving Day").check();
await page.getByRole("button", { name: "Save holidays" }).click();
await page.getByText("Holidays saved.").waitFor();
await shot(page, "S03-closed");
await page.goto(`${BASE}/today?date=${day(4)}`);
await page.getByText("Closed · Vacation").waitFor();
await page.goto(`${BASE}/calendar?view=day&date=${day(3)}`);
await page.getByText("Closed · Vacation").waitFor();
const year = day(0).slice(0, 4);
const thanksgiving = [...Array(7)].map((_, i) => `${year}-11-${String(22 + i).padStart(2, "0")}`)
  .find((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 4);
await page.goto(`${BASE}/calendar?view=day&date=${thanksgiving}`);
await page.getByText("Closed · Thanksgiving Day").waitFor();
step(`closed dates and Thanksgiving (${thanksgiving}) show as closed on Today and the calendar`);

await page.goto(`${BASE}/settings/closed`);
await page.getByRole("button", { name: /Remove closed dates/ }).first().click();
await page.getByText("No closed dates").waitFor();
step("a closed date can be removed");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
