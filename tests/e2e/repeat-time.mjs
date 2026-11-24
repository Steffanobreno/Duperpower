// Repeating a visit at another time, end to end. Run after slice.mjs (Maria Lopez), with DATABASE_URL.
// Book a visit at 11:00 → Repeat → every 2 weeks, 3 times, the next visits at 2:00 PM → 2 more
// visits at 14:00, this one still at 11:00 → reopening Repeat shows 2:00 PM.
// Usage: node tests/e2e/repeat-time.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const db = postgres(process.env.DATABASE_URL);
const [{ client }] = await db`select id as client from clients where first_name = 'Maria'`;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

const day = new Date(Date.now() + 5 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
await page.goto(`${BASE}/appointments/new?client=${client}&date=${day}&time=11:00`);
const sel = page.locator('select[name^="svc:"]');
await sel.selectOption(await sel.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
await page.getByLabel(/Send the confirmation/).uncheck();
await page.getByRole("button", { name: "Book appointment" }).click();
// The day may be outside the hours (a weekend): the warning window offers "Book anyway".
await Promise.race([
  page.waitForURL(/\?booked=1/),
  page.getByRole("button", { name: "Book anyway" }).click(),
]);
await page.waitForURL(/\?booked=1/);
const id = page.url().split("/").pop().split("?")[0];

await page.getByRole("link", { name: /Repeat this appointment/ }).click();
await page.waitForURL(/\/repeat$/);
// Every 2 weeks, 3 times, the next visits at 2:00 PM instead of 11:00 AM.
await page.getByRole("button", { name: "Every 2 weeks" }).click();
await page.locator('input[name="count"]').fill("3");
const time = page.getByLabel("Time for the next visits");
if ((await time.inputValue()) !== "11:00") fail("the time should start at this visit's time");
await time.selectOption("14:00");
const list = page.getByRole("list").filter({ hasText: "this visit" });
if ((await list.getByText("2:00 PM").count()) !== 2) fail("the next two visits should show 2:00 PM");
await shot("RT01-repeat-time");
step("Repeat every 2 weeks: the next visits' time can be changed (2:00 PM), shown in the list");
await page.getByRole("button", { name: "Save and book 2 more" }).click();
await page.getByText(/Booked 2 more visits/).waitFor();
const copies = await db`
  select to_char(start_at at time zone 'America/Los_Angeles', 'HH24:MI') as at from appointments
  where series_id = (select series_id from appointments where id = ${id}) and id <> ${id} order by start_at`;
if (copies.length !== 2 || copies.some((c) => c.at !== "14:00")) fail(`the copies should be at 14:00: ${copies.map((c) => c.at)}`);
const [own] = await db`select to_char(start_at at time zone 'America/Los_Angeles', 'HH24:MI') as at from appointments where id = ${id}`;
if (own.at !== "11:00") fail("this visit keeps its own time");
step("the 2 more visits are booked at 2:00 PM; this visit stays at 11:00 AM");

await page.getByRole("link", { name: "Done" }).click();
await page.getByRole("link", { name: /Repeat appointment/ }).click();
await page.waitForURL(/\/repeat$/);
if ((await page.getByLabel("Time for the next visits").inputValue()) !== "14:00") fail("reopening Repeat should show 2:00 PM");
step("reopening Repeat shows the time chosen for the next visits");

await db.end();
await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
