// Google Maps, end to end, against the fake Google server (dev server started with
// GOOGLE_MAPS_SERVER_KEY, GOOGLE_MAPS_TEST_URL, NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY and
// NEXT_PUBLIC_GOOGLE_MAPS_SCRIPT_URL=<fake>/maps/api/js). Run after slice.mjs.
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
await client.getByLabel("Apt, suite or unit (optional)").fill("Apt 4B");
if (!(await button("Continue").isEnabled())) fail("Continue should be enabled after picking an address");
await button("Continue").click();
await client.getByLabel("Breed").waitFor();
{
  const dbx = postgres(process.env.DATABASE_URL);
  let draft;
  for (let i = 0; i < 25 && !draft?.address_line?.includes("Apt"); i++) {
    [draft] = await dbx`select address_line from booking_drafts order by updated_at desc limit 1`;
    if (!draft?.address_line?.includes("Apt")) await client.waitForTimeout(200);
  }
  await dbx.end();
  if (draft?.address_line !== "1 Main St, Apt 4B") fail(`the unit should be saved with the street: ${draft?.address_line}`);
}
step("booking page: “1 Main” suggests addresses; picking one fills street, city and ZIP; the apartment is kept");

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
await owner.getByLabel("Apt, suite or unit (optional)").fill("Apt 2");
await owner.locator('input[name="first_name"]').fill("Nina");
await owner.locator('input[name="phone"]').fill("650-555-0177");
await owner.getByRole("button", { name: "Save and add a pet" }).click();
await owner.waitForURL(/\/pets\/new/);
await owner.goto(owner.url().replace(/\/pets\/new.*/, ""));
await owner.getByText("1 Main St, Apt 2").first().waitFor();
step("client form: the same suggestions fill street, city, state and ZIP; the apartment is saved with the street");

// Today: driving times from home to the visit and back (the fake answers 10, then 20 min).
await owner.goto(`${BASE}/settings/team`);
await owner.getByRole("link", { name: /Owner/ }).first().click();
await owner.getByLabel(/Day starts at/).fill("100 Home St, San Mateo, CA");
await owner.getByLabel(/Day ends at/).fill("100 Home St, San Mateo, CA");
await owner.getByRole("button", { name: "Save van and route" }).click();
await owner.getByText("Saved.").first().waitFor();
await owner.goto(`${BASE}/today?date=${DATE}`);
// The map view is Google's (the fake Maps JavaScript API), with the road path, not the dashed line.
await owner.locator("[data-fake-google-map] .gmap-pin").first().waitFor();
if ((await owner.locator(".leaflet-container").count()) !== 0) fail("the map should be Google's, not OpenStreetMap");
if ((await owner.locator('.gmap-line[data-dashed="0"]').count()) !== 1) fail("the road path should be drawn as a solid line");
if (!(await owner.locator(".gmap-pin").first().getAttribute("data-icon")).includes("#f97316")) fail("the first visit's pin should be highlighted");
await owner.getByText("🚐 10min drive").first().waitFor();
// The list view: every leg and the day's total.
await owner.goto(`${BASE}/today?date=${DATE}&view=list`);
await owner.getByText("Driving", { exact: true }).waitFor();
await owner.getByText("🚐 10min drive from the start").waitFor();
await owner.getByText("🚐 20min drive back to the end of the day").waitFor();
await owner.getByText("30min", { exact: true }).waitFor();
if (SHOTS) await owner.screenshot({ path: `${SHOTS}/M02-today-driving.png`, fullPage: true });
step("Today: 10 min from home, 20 min back, 30 min driving in total; the Google map draws the road path");

// "Find the best order": two visits on another day; the fake Google says the reverse order is
// best (5 min per leg instead of 10, 20…), and "Use this order" moves the times.
{
  const dbx = postgres(process.env.DATABASE_URL);
  const [{ client: maria }] = await dbx`select id as client from clients where first_name = 'Maria'`;
  const day = new Date(Date.parse(`${DATE}T12:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  const ids = [];
  for (const time of ["09:00", "13:00"]) {
    await owner.goto(`${BASE}/appointments/new?client=${maria}&date=${day}&time=${time}`);
    const sel = owner.locator('select[name^="svc:"]');
    await sel.selectOption(await sel.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
    await owner.getByLabel(/Send the confirmation/).uncheck();
    await owner.getByRole("button", { name: "Book appointment" }).click();
    await owner.waitForURL(/\?booked=1/);
    ids.push(owner.url().split("/").pop().split("?")[0]);
  }
  await owner.goto(`${BASE}/today?date=${day}`);
  await owner.getByRole("link", { name: "🧭 Find the best order" }).click();
  await owner.getByText(/This order saves/).waitFor();
  if (SHOTS) await owner.screenshot({ path: `${SHOTS}/M03-best-order.png` });
  await owner.getByRole("button", { name: "Use this order (moves the times)" }).click();
  await owner.waitForURL(/reordered=1/);
  const rows = await dbx`select id, to_char(start_at at time zone 'America/Los_Angeles', 'HH24:MI') as t from appointments where id = any(${ids})`;
  const at = Object.fromEntries(rows.map((r) => [r.id, r.t]));
  await dbx.end();
  if (at[ids[1]] !== "09:00") fail(`the 1 PM visit should now start the day at 9:00, is ${at[ids[1]]}`);
  if (at[ids[0]] <= "09:00") fail(`the 9 AM visit should now come after, is ${at[ids[0]]}`);
  // "On my way" with the arrival time from the phone's location (the fake says 10 min).
  await owner.context().grantPermissions(["geolocation"]);
  await owner.context().setGeolocation({ latitude: 37.55, longitude: -122.3 });
  await owner.goto(`${BASE}/appointments/${ids[0]}`);
  await owner.evaluate(() => { window.__sms = null; window.__woofersSms = (u) => (window.__sms = u); });
  await owner.getByRole("button", { name: "On my way" }).click();
  await owner.waitForFunction(() => window.__sms);
  const sms = decodeURIComponent(await owner.evaluate(() => window.__sms));
  if (!/about 10 min \(around \d{1,2}:\d{2} [AP]M\)/.test(sms)) fail(`the text should carry the arrival time: ${sms}`);
  const dby = postgres(process.env.DATABASE_URL);
  const [{ status }] = await dby`select status from appointments where id = ${ids[0]}`;
  await dby.end();
  if (status !== "en_route") fail(`the visit should be on the way, is ${status}`);
  step(`best order: the visits swap (now 9:00 and ${at[ids[0]]}), the drive saved shown first; “On my way” texts “about 10 min” and marks it on the way`);
}

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
