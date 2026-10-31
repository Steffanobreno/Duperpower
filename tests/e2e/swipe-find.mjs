// Swiping dates, the date fields' calendar, and finding clients fast. Run after slice.mjs, with
// DATABASE_URL. Calendar week view: a swipe left turns to the next week · a date field opens our
// month calendar (arrows, swipe, pick a day) · Clients: typing filters at once; the A–Z strip
// jumps to a letter · the booking picker has the same.
// Usage: node tests/e2e/swipe-find.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const db = postgres(process.env.DATABASE_URL);
const [{ biz }] = await db`select id as biz from businesses limit 1`;
for (const [first, last, phone] of [["Alice", "Wong", "+16505550101"], ["Bruno", "Lima", "+16505550102"], ["Carla", "Diaz", "+16505550103"],
  ["Diego", "Ruiz", "+16505550104"], ["Zoe", "Park", "+16505550105"], ["Yara", "Kim", "+16505550106"]]) {
  await db`insert into clients (business_id, first_name, last_name, phone) values (${biz}, ${first}, ${last}, ${phone})`;
}
// Enough clients to scroll.
for (let i = 0; i < 30; i++) {
  await db`insert into clients (business_id, first_name, last_name, phone) values (${biz}, ${"Mateo"}, ${`Test ${i}`}, ${`+1650555${String(2000 + i)}`})`;
}
await db.end();
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const cdp = await page.context().newCDPSession(page);
const swipe = async (locator, dx) => {
  const b = await locator.boundingBox();
  const y = b.y + Math.min(b.height / 2, 200);
  const x0 = b.x + b.width / 2 - dx / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (dx * i) / 8, y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
};

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

// Calendar week view: swipe left → next week.
await page.goto(`${BASE}/calendar?view=week&date=2026-03-04`);
await page.getByText("Mar 2 – Mar 8").waitFor();
await swipe(page.locator("main section, main .card").last(), -220);
await page.waitForURL(/date=2026-03-11/);
step("Calendar week view: a swipe turns to the next week");

// A date field opens our calendar: next month by arrow, then pick the 10th.
await page.goto(`${BASE}/reports?from=2026-03-01&to=2026-03-31`);
await page.locator("label", { hasText: "From" }).getByRole("button").click();
await page.getByRole("dialog", { name: "Pick a day" }).getByRole("button", { name: "Next month" }).click();
await page.getByRole("button", { name: "Friday, April 10, 2026" }).click();
if ((await page.locator('input[name="from"]').inputValue()) !== "2026-04-10") fail("picking a day should set the field");
await page.locator("label", { hasText: "From" }).getByRole("button").click();
await swipe(page.getByLabel("April 2026"), -200);
await page.getByRole("button", { name: "Friday, May 1, 2026" }).waitFor();
await page.waitForTimeout(500);
if (SHOTS) await page.screenshot({ path: `${SHOTS}/W01-date-field.png` });
// Tapping the field's name (its label) opens the same calendar.
await page.getByRole("heading", { name: "Reports" }).click();
await page.getByRole("dialog", { name: "Pick a day" }).waitFor({ state: "detached" });
await page.locator("label", { hasText: "To" }).locator("span", { hasText: /^To$/ }).click();
await page.getByRole("dialog", { name: "Pick a day" }).waitFor();
step("a date field opens the month calendar: arrows and swipe change the month, a tap picks the day");

// Clients: live search and the A–Z strip.
await page.goto(`${BASE}/clients`);
const rows = page.locator("li[data-search]:visible");
await page.getByLabel("Search clients").fill("zoe");
await page.waitForFunction(() => document.querySelectorAll("li[data-search]:not([hidden])").length === 1);
if (!(await rows.first().textContent()).includes("Zoe Park")) fail("typing “zoe” should leave Zoe Park");
await page.getByLabel("Search clients").fill("");
await page.getByRole("button", { name: "Jump to Z" }).click();
await page.waitForFunction(() => window.scrollY > 200);
const inView = await page.evaluate(() => {
  const r = [...document.querySelectorAll("li[data-search]")].find((x) => x.textContent.includes("Yara Kim")).getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight;
});
if (!inView) fail("after Z, Yara Kim (the end of the list) should be on screen");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/W02-clients-az.png` });
step("Clients: typing filters at once; the A–Z strip jumps to the letter");

// The booking picker has the same.
await page.goto(`${BASE}/appointments/new`);
await page.getByRole("button", { name: "Jump to M" }).waitFor();
await page.getByLabel("Search clients").fill("bru");
await page.waitForFunction(() => document.querySelectorAll("li[data-search]:not([hidden])").length === 1);
step("booking: the client picker filters as you type and has the A–Z strip");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
