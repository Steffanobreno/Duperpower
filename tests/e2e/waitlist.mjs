// The waitlist, end to end. Run after slice.mjs (Maria Lopez), with DATABASE_URL.
// Rita has a visit on a day; Maria wants that day → added to the waitlist from her page →
// Rita cancels → Today says a spot opened; the Waitlist shows it with Text and Book → booking
// Maria at that time takes her off the list.
// Usage: node tests/e2e/waitlist.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const db = postgres(process.env.DATABASE_URL);
const [{ biz }] = await db`select id as biz from businesses limit 1`;
const [{ maria }] = await db`select id as maria from clients where first_name = 'Maria'`;
const [{ rita }] = await db`insert into clients (business_id, first_name, last_name, phone, address_line, city, zip)
  values (${biz}, 'Rita', 'Moss', '+16505550190', '5 Oak St', 'San Mateo', '94401') returning id as rita`;
// A weekday a few days ahead.
let n = 5;
const la = (k) => new Date(Date.now() + k * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
while ([0, 6].includes(new Date(`${la(n)}T12:00:00Z`).getUTCDay())) n++;
const DAY = la(n);

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

const book = async (client, time) => {
  await page.goto(`${BASE}/appointments/new?client=${client}&date=${DAY}&time=${time}`);
  const sel = page.locator('select[name^="svc:"]');
  await sel.selectOption(await sel.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
  await page.getByLabel(/Send the confirmation/).uncheck();
  await page.getByRole("button", { name: "Book appointment" }).click();
  await page.waitForURL(/\?booked=1/);
  return page.url().split("/").pop().split("?")[0];
};
// Rita needs a pet to be booked.
await db`insert into pets (client_id, name, size_class) values (${rita}, 'Bolt', 'medium')`;
const ritaVisit = await book(rita, "10:00");

// Maria wants that day: added from her page.
await page.goto(`${BASE}/clients/${maria}`);
await page.getByRole("link", { name: "+ Waitlist" }).click();
await page.getByLabel("First day").fill(DAY);
await page.locator('input[name="note"]').fill("Mornings only");
await page.getByRole("button", { name: "Add to waitlist" }).click();
await page.waitForURL(/\/waitlist\?added=1/);
await page.getByText("Maria Lopez").waitFor();
if (await page.getByText(/A spot opened/).count()) fail("no spot has opened yet");
step("Maria is on the waitlist for that day, nothing open yet");

// Rita cancels: Today and the Waitlist say a spot opened.
await db`update appointments set status = 'cancelled', cancelled_at = now() where id = ${ritaVisit}`;
await page.goto(`${BASE}/today`);
await page.getByRole("link", { name: /A spot opened · 1 on the waitlist/ }).click();
await page.waitForURL(/\/waitlist/);
await page.getByText(/🔔 A spot opened: .* at 10:00 AM/).waitFor();
const text = await page.getByRole("link", { name: "Text them" }).getAttribute("href");
if (!decodeURIComponent(text).includes("A spot just opened")) fail("the text should offer the spot");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/L01-waitlist-spot.png` });
step("Rita cancels → Today's banner → the Waitlist shows the spot with Text and Book");

// Book Maria there: she leaves the list.
await page.getByRole("link", { name: "Book them" }).click();
await page.waitForURL(/\/appointments\/new\?client=.*time=10:00/);
const sel = page.locator('select[name^="svc:"]');
await sel.selectOption(await sel.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
await page.getByLabel(/Send the confirmation/).uncheck();
await page.getByRole("button", { name: "Book appointment" }).click();
await page.waitForURL(/\?booked=1/);
const [{ status }] = await db`select status from waitlist where client_id = ${maria} order by created_at desc limit 1`;
if (status !== "booked") fail(`Maria should be off the list, is ${status}`);
await page.goto(`${BASE}/waitlist`);
await page.getByText("Nobody is waiting").waitFor();
step("booking Maria at that time takes her off the waitlist");

await db.end();
await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
