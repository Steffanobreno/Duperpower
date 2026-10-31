// Google Maps, end to end, against the fake Google server (dev server started with
// GOOGLE_MAPS_SERVER_KEY and GOOGLE_MAPS_TEST_URL). Run after slice.mjs.
// Booking page: typing "1 Main" suggests addresses; picking one fills street, city and ZIP ·
// the owner's client form does the same · Today shows driving times between stops.
// Needs DATABASE_URL (to find the visit's day). Usage: node tests/e2e/google-maps.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const db = postgres(process.env.DATABASE_URL);
const [{ date: DATE }] = await db`select to_char(start_at at time zone 'America/Los_Angeles', 'YYYY-MM-DD') as date
                                   from appointments order by created_at limit 1`;
await db.end();
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const newPage = async () => {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
};
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

// The booking page.
const client = await newPage();
const button = (name) => client.getByRole("button", { name, exact: true });
await client.goto(`${BASE}/book`);
await client.getByLabel("Mobile phone").fill("650-555-0166");
await button("Next").click();
await client.getByLabel("First name").fill("Lia");
await client.getByLabel("Last name").fill("Park");
await client.getByLabel("Email").fill("lia@example.com");
await button("Continue").click();
await client.getByLabel("Street address").pressSequentially("1 Main", { delay: 40 });
await client.getByRole("option", { name: /1 Main St San Mateo/ }).click();
await client.waitForFunction(() => document.querySelector('input[aria-label="ZIP code"]')?.value === "94401");
if ((await client.getByLabel("Street address").inputValue()) !== "1 Main St") fail("street not filled");
if ((await client.getByLabel("City").inputValue()) !== "San Mateo") fail("city not filled");
if (SHOTS) await client.screenshot({ path: `${SHOTS}/M01-address-suggestions.png` });
if (!(await button("Continue").isEnabled())) fail("Continue should be enabled after picking an address");
await button("Continue").click();
await client.getByLabel("Breed").waitFor();
step("booking page: “1 Main” suggests addresses; picking one fills street, city and ZIP");

// The owner's new client form.
const owner = await newPage();
await owner.goto(`${BASE}/login`);
await owner.fill('input[name="email"]', "owner@example.com");
await owner.fill('input[name="password"]', "correct horse battery");
await owner.click('button[type="submit"]');
await owner.waitForURL(/\/today/);
await owner.goto(`${BASE}/clients/new`);
await owner.getByLabel("Street address").pressSequentially("1 Main", { delay: 40 });
await owner.getByRole("option", { name: /1 Main St San Mateo/ }).click();
await owner.waitForFunction(() => document.querySelector('input[name="zip"]')?.value === "94401");
if ((await owner.locator('input[name="city"]').inputValue()) !== "San Mateo") fail("owner form city not filled");
if ((await owner.locator('input[name="state"]').inputValue()) !== "CA") fail("owner form state not filled");
step("client form: the same suggestions fill street, city, state and ZIP");

// Today: driving times from home to the visit and back (the fake answers 10, then 20 min).
await owner.goto(`${BASE}/settings/team`);
await owner.getByRole("link", { name: /Owner/ }).first().click();
await owner.getByLabel(/Day starts at/).fill("100 Home St, San Mateo, CA");
await owner.getByLabel(/Day ends at/).fill("100 Home St, San Mateo, CA");
await owner.getByRole("button", { name: "Save van and route" }).click();
await owner.getByText("Saved.").first().waitFor();
await owner.goto(`${BASE}/today?date=${DATE}`);
await owner.getByText("Driving", { exact: true }).waitFor();
await owner.getByText("🚐 10min drive from the start").waitFor();
await owner.getByText("🚐 20min drive back to the end of the day").waitFor();
await owner.getByText("30min", { exact: true }).waitFor();
if (SHOTS) await owner.screenshot({ path: `${SHOTS}/M02-today-driving.png`, fullPage: true });
step("Today: 10 min from home, 20 min back, 30 min driving in total");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
