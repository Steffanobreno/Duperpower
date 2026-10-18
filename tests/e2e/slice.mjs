// End-to-end check of the core loop on a fresh database, at iPhone width:
// set up the owner, add a client and pet, book, run the day, check out with Venmo + tip.
// Usage: node tests/e2e/slice.mjs [baseUrl] [screenshotDir]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3] ?? "replica/clone-screens";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true, caret: "initial" });
const step = (msg) => console.log(`✓ ${msg}`);

// Next weekday at 10:00, so the booking is inside working hours.
const d = new Date();
do d.setDate(d.getDate() + 1);
while (d.getDay() === 0);
const date = d.toISOString().slice(0, 10);

await page.goto(`${BASE}/login`);
await page.waitForURL(/\/setup/);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.fill('input[name="confirm"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
await shot("S02-today-empty");
step("owner account created, landed on Today");

await page.goto(`${BASE}/clients/new`);
await page.fill('input[name="first_name"]', "Maria");
await page.fill('input[name="last_name"]', "Lopez");
await page.fill('input[name="phone"]', "(650) 555-0142");
await page.fill('input[name="address_line"]', "450 Serra Mall");
await page.fill('input[name="city"]', "Stanford");
await page.fill('input[name="zip"]', "94305");
await page.fill('textarea[name="access_notes"]', "Park in the driveway, outlet by the garage.");
await page.click('button[type="submit"]');
await page.waitForURL(/\/pets\/new/);
step("client saved");

await page.fill('input[name="name"]', "Biscuit");
await page.fill('input[name="breed"]', "Goldendoodle");
await page.selectOption('select[name="size_class"]', "medium");
await page.fill('input[name="rebook_every_days"]', "42");
await page.fill('textarea[name="behavior"]', "Nervous with the dryer");
await page.click('button[name="then"][value="book"]');
await page.waitForURL(/\/appointments\/new\?client=/);
step("pet saved, went straight to booking");

await page.goto(page.url().replace(/&?date=[^&]*/, "") + `&date=${date}&time=10:00`);
const select = page.locator('select[name^="svc:"]');
const option = await select.locator("option", { hasText: "Full Haircut - Medium" }).getAttribute("value");
await select.selectOption(option);
await page.locator("summary", { hasText: "Add-ons" }).click();
await page.getByLabel("De-shedding").check();
await shot("S05-new-appointment");
await page.getByRole("button", { name: "Book appointment" }).click();
await page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/);
await page.getByText("$194.00").first().waitFor();
await shot("S06-appointment");
step("booked Full Haircut Medium + De-shedding = $194");

// Double booking must be refused by the database.
const apptUrl = page.url().split("?")[0];
const clientId = (await page.getByRole("link", { name: "Client profile" }).getAttribute("href")).split("/")[2];
await page.goto(`${BASE}/appointments/new?client=${clientId}&date=${date}&time=10:30`);
const sel2 = page.locator('select[name^="svc:"]');
await sel2.selectOption(await sel2.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
await page.getByRole("button", { name: "Book appointment" }).click();
await page.getByText("You already have an appointment at that time").waitFor();
step("overlapping booking refused");

await page.goto(`${BASE}/today?date=${date}`);
await page.getByText("Maria Lopez").waitFor();
await page.getByRole("link", { name: "Open the whole route in Google Maps" }).waitFor();
await shot("S02-today-route");
step("Today shows the stop and the Google Maps route link");

await page.goto(apptUrl);
for (const label of ["Mark as confirmed", "I'm on the way", "Arrived, start grooming", "Finish and check out"]) {
  await page.getByRole("button", { name: label }).click();
  await page.waitForLoadState("networkidle");
}
await page.waitForURL(/\/checkout/);
step("status moved confirmed → on the way → grooming → done");

await page.getByText("Venmo", { exact: true }).click();
await page.getByRole("button", { name: /^20%/ }).click();
await page.fill('input[name="reference"]', "@maria-lopez");
await shot("S13-checkout");
await page.getByRole("button", { name: /^Record/ }).click();
await page.getByText("Paid in full").waitFor();
await page.getByText("incl. $38.80 tip").waitFor();
await shot("S13-checkout-paid");
step("paid by Venmo with a 20% tip ($38.80)");

await page.goto(`${BASE}/calendar?date=${date}`);
await page.getByText("Maria Lopez").waitFor();
await shot("S04-calendar");
await page.goto(`${BASE}/settings/services`);
await shot("S18-services");
await page.goto(`${BASE}/settings/hours`);
await shot("S17-hours");
step("calendar, services and hours render");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
