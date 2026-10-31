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
step("Today opens as a map with the week on top and three visit cards");

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

// The list view is still there.
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
