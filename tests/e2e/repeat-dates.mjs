// Repeating a visit on days picked one by one, end to end. Run after slice.mjs (Maria Lopez),
// with DATABASE_URL. Book a visit → Repeat → "Pick dates" → two days next month on the calendar →
// 2 more visits booked on exactly those days, same time → the visit says "On 3 chosen dates" →
// reopening Repeat shows the two days picked.
// Usage: node tests/e2e/repeat-dates.mjs [baseUrl] [screenshotDir]
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
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

const day = new Date(Date.now() + 3 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
await page.goto(`${BASE}/appointments/new?client=${client}&date=${day}&time=11:00`);
const sel = page.locator('select[name^="svc:"]');
await sel.selectOption(await sel.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
await page.getByLabel(/Send the confirmation/).uncheck();
await page.getByRole("button", { name: "Book appointment" }).click();
await page.waitForURL(/\?booked=1/);
const id = page.url().split("/").pop().split("?")[0];

await page.getByRole("link", { name: /Repeat this appointment/ }).click();
await page.waitForURL(/\/repeat$/);
await page.getByRole("button", { name: "Pick dates" }).click();
await page.getByRole("button", { name: "Next month" }).click();
// The 10th and the 20th of next month.
const next = new Date(Date.parse(`${day.slice(0, 7)}-15T12:00:00Z`));
next.setUTCMonth(next.getUTCMonth() + 1);
const ym = next.toISOString().slice(0, 7);
const label = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
const picks = [`${ym}-10`, `${ym}-20`];
for (const d of picks) await page.getByRole("button", { name: label(d), exact: true }).click();
await page.getByRole("heading", { name: "3 visits" }).waitFor();
// Tapping a day twice takes it off again.
await page.getByRole("button", { name: label(`${ym}-15`), exact: true }).click();
await page.getByRole("heading", { name: "4 visits" }).waitFor();
await page.getByRole("button", { name: label(`${ym}-15`), exact: true }).click();
await page.getByRole("heading", { name: "3 visits" }).waitFor();
// The second day at another time.
const short = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });
await page.getByLabel(`Time on ${short(picks[1])}`).selectOption("14:30");
await page.getByText("2:30 PM", { exact: true }).last().waitFor();
if (SHOTS) await page.screenshot({ path: `${SHOTS}/P01-repeat-pick-dates.png`, fullPage: true });
await page.getByRole("button", { name: "Save and book 2 more" }).click();
await page.getByText(/Booked 2 more visits: on 3 chosen dates/).waitFor();
const copies = await db`
  select to_char(start_at at time zone 'America/Los_Angeles', 'YYYY-MM-DD HH24:MI') as at from appointments
  where series_id = (select series_id from appointments where id = ${id}) and id <> ${id} order by start_at`;
if (copies.map((c) => c.at).join() !== [`${picks[0]} 11:00`, `${picks[1]} 14:30`].join()) fail(`copies should be on the picked days and times: ${copies.map((c) => c.at)}`);
step("Pick dates: two days next month, the second at 2:30 PM → 2 more visits on exactly those days and times");

await page.getByRole("link", { name: "Done" }).click();
await page.getByText("On 3 chosen dates · 2 more after this one").waitFor();
await page.getByRole("link", { name: /Repeat appointment/ }).click();
await page.getByRole("button", { name: `Remove ${short(picks[0])}` }).waitFor();
if ((await page.getByLabel(`Time on ${short(picks[1])}`).inputValue()) !== "14:30") fail("reopening Repeat should keep the 2:30 PM day");
step("the visit says “On 3 chosen dates”; reopening Repeat shows the days picked");

await db.end();
await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
