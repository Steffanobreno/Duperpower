// Today as a map with the visits as cards, end to end. Run after slice.mjs (Maria's visit at
// 10:00), with DATABASE_URL. Books two more visits that day → map view by default, week strip,
// three cards; swiping the cards changes the highlighted pin; Contact shows Call and Text; the
// card's next step moves the visit along; the List view still has the list.
// Usage: node tests/e2e/today-map.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const db = postgres(process.env.DATABASE_URL);
const [{ date, client }] = await db`
  select to_char(a.start_at at time zone 'America/Los_Angeles', 'YYYY-MM-DD') as date, a.client_id as client
  from appointments a order by a.created_at limit 1`;
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

for (const time of ["13:00", "15:30"]) {
  await page.goto(`${BASE}/appointments/new?client=${client}&date=${date}&time=${time}`);
  const sel = page.locator('select[name^="svc:"]');
  await sel.selectOption(await sel.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
  await page.getByLabel(/Send the confirmation/).uncheck();
  await page.getByRole("button", { name: "Book appointment" }).click();
  await page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/);
}

await page.goto(`${BASE}/today?date=${date}`);
await page.getByRole("img", { name: "Map of the day's visits" }).waitFor();
const cards = page.getByRole("list", { name: "Visits" }).getByRole("listitem");
if ((await cards.count()) !== 3) fail(`3 cards expected, got ${await cards.count()}`);
await page.getByRole("link", { name: /visits?$/ }).first().waitFor(); // week strip day with dots
if (SHOTS) await page.screenshot({ path: `${SHOTS}/D01-today-map.png` });
const gap = await page.evaluate(() =>
  document.querySelector('nav[aria-label="Main"]').getBoundingClientRect().top - document.querySelector('[aria-label="Visits"]').getBoundingClientRect().bottom);
if (gap < 0) fail(`the cards are ${-gap}px under the tab bar`);
step("Today opens as a map with the week on top and three visit cards, all above the tab bar");

// Swipe to the second card: its pin is highlighted.
const pinOf = (n) => page.locator(".route-pin", { hasText: String(n) });
await page.getByRole("list", { name: "Visits" }).evaluate((el) => el.scrollTo({ left: el.children[1].offsetLeft - 20 }));
await page.waitForFunction(() => document.querySelector('[role="listitem"][aria-current="true"]')?.textContent?.includes("2."));
await pinOf(2).and(page.locator(".route-pin-active")).waitFor();
step("swiping to the second card highlights pin 2");

// Contact, then the next step on the card.
const second = cards.nth(1);
await second.getByRole("button", { name: "Contact" }).click();
await second.getByRole("link", { name: "Call" }).waitFor();
await second.getByRole("link", { name: "Text" }).waitFor();
await second.getByRole("button", { name: "Close" }).click();
await second.getByRole("button", { name: "On my way" }).click();
await second.getByText("ON THE WAY").waitFor();
if (SHOTS) await page.screenshot({ path: `${SHOTS}/D02-today-card.png` });
step("Contact shows Call and Text; “On my way” moves the visit along");

// The dates: one week; ▾ opens the whole month and the map gets smaller; ▴ closes it.
await page.getByRole("link", { name: "Show the whole month" }).click();
await page.waitForURL(/cal=1/);
await page.getByRole("link", { name: "Next month" }).waitFor();
if ((await page.locator("a[aria-current='date']").count()) !== 1) fail("the chosen day should be marked");
const monthCells = await page.locator('a[aria-label*=", "][href*="date="]').count();
if (monthCells < 28) fail(`the whole month should show, got ${monthCells} days`);
const mapHeight = await page.getByRole("img", { name: "Map of the day's visits" }).evaluate((e) => e.parentElement.offsetHeight);
if (mapHeight > 340) fail(`the map should get smaller, is ${mapHeight}px`);
if (SHOTS) await page.screenshot({ path: `${SHOTS}/D03-today-month.png` });
await page.getByRole("link", { name: "Show one week" }).click();
await page.waitForURL((u) => !u.search.includes("cal=1"));
step(`▾ opens the whole month (${monthCells} days) with a smaller map; ▴ goes back to the week`);

// Map ↔ Agenda.
await page.getByRole("link", { name: "Agenda", exact: true }).click();
await page.waitForURL(/\/calendar\?view=day/);
await page.getByRole("link", { name: "Map", exact: true }).click();
await page.waitForURL(/\/today\?date=/);
await page.getByRole("img", { name: "Map of the day's visits" }).waitFor();
step("Agenda opens the day's schedule; Map comes back");

// The client's receipt page opened from the app has a way back.
const [{ token }] = await db`select public_token as token from invoices where status = 'closed' limit 1`;
await page.goto(`${BASE}/r/${token}`);
await page.getByRole("link", { name: "← Back to the app" }).click();
await page.waitForURL(/\/receipts\//);
step("the client's receipt page has “Back to the app” for the team");

// The list view is still there.
await page.goto(`${BASE}/today?date=${date}`);
await page.getByRole("link", { name: "List", exact: true }).click();
await page.waitForURL(/view=list/);
await page.getByRole("link", { name: /Directions/ }).first().waitFor();
step("the List view still shows the day as a list");

await db.end();
await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
