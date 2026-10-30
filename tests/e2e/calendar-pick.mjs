// Calendar navigation and picking times on it, end to end. Run after slice.mjs (Maria Lopez,
// a finished visit on the next working day at 10:00).
// Arrows turn a week · swiping the week strip turns a week, swiping the day turns a day ·
// dots mark days with visits · Reschedule and Book again open the calendar to tap a time.
// Usage: node tests/e2e/calendar-pick.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const shot = (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
const dateOf = (url) => new URL(url).searchParams.get("date");
const plus = (d, n) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

// A finger swipe (touch events) across an element.
const cdp = await ctx.newCDPSession(page);
async function swipe(locator, dx) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  const box = await locator.boundingBox();
  const y = box.y + Math.min(box.height / 2, 40);
  const x0 = box.x + box.width / 2 - dx / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (dx * i) / 6, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

// Maria's finished visit (from slice.mjs) and its day.
await page.goto(`${BASE}/clients?q=Maria`);
await page.getByRole("link", { name: /Maria/ }).first().click();
await page.waitForURL(/\/clients\/[0-9a-f-]+$/);
const clientId = page.url().split("/").pop();
await page.locator('a[href^="/appointments/"]:not([href*="new"])').first().click();
await page.waitForURL(/\/appointments\/[0-9a-f-]+$/);
const doneUrl = page.url();
const day = dateOf(new URL(await page.getByRole("link", { name: "See this day in the calendar" }).getAttribute("href"), BASE).href);

// Arrows turn a week; the dots show the visit.
await page.goto(`${BASE}/calendar?view=day&date=${day}`);
const strip = page.locator("[aria-current='date']").locator("xpath=..");
if (!(await page.locator(`a[aria-label$="1 visit"][aria-current="date"]`).count())) fail("no dot for the day with Maria's visit");
await shot("C01-calendar-dots");
await page.getByRole("link", { name: "Next" }).click();
await page.waitForURL((u) => dateOf(u.href) === plus(day, 7));
await page.getByRole("link", { name: "Previous" }).click();
await page.waitForURL((u) => dateOf(u.href) === day);
step("arrows turn a whole week; the visit's day has a dot");

// Swipe the week strip: next week. Swipe the day: next day.
await swipe(strip, -200);
await page.waitForURL((u) => dateOf(u.href) === plus(day, 7));
await swipe(page.locator("[aria-current='date']").locator("xpath=.."), 200);
await page.waitForURL((u) => dateOf(u.href) === day);
await swipe(page.getByRole("region", { name: "Day schedule" }), -200);
await page.waitForURL((u) => dateOf(u.href) === plus(day, 1));
step("swiping the week strip turns the week; swiping the day turns the day");

// Book a visit, then Reschedule it from the calendar.
await page.goto(`${BASE}/appointments/new?client=${clientId}&date=${plus(day, 2)}&time=10:00`);
const select = page.locator('select[name^="svc:"]');
await select.selectOption(await select.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
await page.getByRole("button", { name: "Book appointment" }).click();
await page.waitForURL(/\?booked=1/);
const apptUrl = page.url().split("?")[0];
await page.getByRole("link", { name: "Reschedule" }).first().click();
await page.waitForURL(/pick=move/);
await page.getByText("Moving Maria Lopez's visit (2h)").waitFor();
await shot("C02-calendar-moving");
await page.getByRole("button", { name: / · 2:00 PM: move to this hour/ }).click();
await page.getByRole("link", { name: "Move to 2:30 PM" }).click();
await page.waitForURL(/move=1/);
await page.getByText(/Move to .* at 2:30 PM\?/).waitFor();
await shot("C03-move-confirm");
await page.getByRole("button", { name: "Move appointment" }).first().click();
await page.waitForURL(apptUrl);
await page.getByText("2:30 PM – 4:30 PM · 2h").waitFor();
step("Reschedule opens the calendar; tapping 2:30 PM moves the visit there");

// Book again opens the calendar too, and the pick lands on the booking form.
await page.goto(doneUrl);
await page.getByRole("link", { name: "Book again" }).click();
await page.waitForURL(/pick=book/);
await page.getByText("Booking Maria Lopez").waitFor();
await page.getByRole("button", { name: / · 9:00 AM: book at this hour/ }).click();
await page.getByRole("link", { name: "Book at 9:15 AM" }).click();
await page.waitForURL(/\/appointments\/new\?client=.*time=09:15/);
step("Book again opens the calendar; tapping 9:15 AM opens the booking form at that time");

// A finished visit's time can be corrected, without texting the client.
await page.goto(doneUrl);
await page.getByRole("link", { name: "Reschedule" }).first().click();
await page.getByRole("button", { name: / · 3:00 PM: move to this hour/ }).click();
await page.getByRole("link", { name: "Move to 3:00 PM" }).click();
await page.waitForURL(/move=1/);
if (await page.getByLabel("Tell the client about the new time").count()) fail("a finished visit offered to text the client");
await page.getByRole("button", { name: "Move appointment" }).first().click();
await page.waitForURL(doneUrl);
await page.getByText("3:00 PM – 5:00 PM · 2h").waitFor();
await page.locator("summary", { hasText: "Finished" }).waitFor();
step("a finished visit's time is corrected and it stays Finished");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
