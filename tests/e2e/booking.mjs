// Online booking, end to end. Run after slice.mjs on the same database (it reuses that owner).
// Client requests on /book → owner accepts → iPhone outbox returns the texts once →
// client confirms from the link → calendar feed lists it → a far ZIP can't take that day.
// Usage: node tests/e2e/booking.mjs [baseUrl] [screenshotDir]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3] ?? "replica/clone-screens";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true, caret: "initial" });
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

async function requestVisit({ pet, size, zip, city, phone, pickDay }) {
  await page.goto(`${BASE}/book`);
  await page.getByLabel("Pet's name").fill(pet);
  await page.getByLabel("Breed").fill("Maltese");
  await page.locator("label", { hasText: size }).first().click();
  await page.locator("label", { hasText: "Bath" }).filter({ hasText: "$" }).first().click();
  await page.getByLabel("Street address").fill("1 Main St");
  await page.getByLabel("City").fill(city);
  await page.getByLabel("ZIP code").fill(zip);
  await page.getByRole("button", { name: "See available times" }).click();
  await page.getByRole("tablist", { name: "Day" }).waitFor();
  const days = await page.getByRole("tab").allTextContents();
  if (pickDay === null) return days;
  if (pickDay) await page.getByRole("tab", { name: pickDay }).click();
  const chosenDay = await page.locator('[role="tab"][aria-selected="true"]').textContent();
  await page.locator('button[aria-pressed]').first().click();
  await page.getByLabel("First name").fill("Ana");
  await page.getByLabel("Last name").fill("Silva");
  await page.getByLabel("Mobile phone").fill(phone);
  await page.getByLabel("Email").fill("ana@example.com");
  await page.getByLabel("I have read and agree to the service agreement.").check();
  await page.getByLabel("Type your full name to sign").fill("Ana Silva");
  await shot("S35-book-times");
  await page.getByRole("button", { name: "Request this appointment" }).click();
  await page.getByText("Request sent!").waitFor();
  return chosenDay;
}

// Automatic messages start switched off (so clients don't get doubles while the old app runs).
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
await page.goto(`${BASE}/settings/messages`);
await page.getByRole("button", { name: "Turn automatic messages on" }).click();
await page.getByRole("button", { name: "Turn automatic messages off" }).waitFor();
step("owner switched automatic messages on");

const day = await requestVisit({ pet: "Luna", size: "Small", zip: "94401", city: "San Mateo", phone: "(650) 555-0177" });
await shot("S38-book-sent");
step(`client requested a Small bath on ${day}`);

// A ZIP ~40 miles away must not be offered that same day (25-mile rule).
const farDays = await requestVisit({ pet: "Max", size: "Small", zip: "95060", city: "Santa Cruz", phone: "(831) 555-0100", pickDay: null });
if (farDays.includes(day)) fail(`Santa Cruz was offered ${day}, which already has a San Mateo stop`);
step("a stop 40 miles away is not offered that day");

await page.goto(`${BASE}/today`);
await page.getByRole("link", { name: /booking request/ }).click();
await page.getByText("Ana Silva").waitFor();
await shot("S08-requests");
await page.getByRole("button", { name: "Accept" }).click();
await page.getByText("No requests waiting").waitFor();
step("owner accepted the request");

await page.goto(`${BASE}/settings/messages`);
const outboxUrl = await page.getByLabel("Link for the Shortcut").inputValue();
const calendarUrl = await page.getByLabel("Calendar link").inputValue();
await shot("S20-messages-settings");

const first = await (await fetch(outboxUrl)).json();
// The outbox can also hold texts for other clients (e.g. from slice.mjs); look at Ana's.
const bodies = first.messages.filter((m) => m.phone === "+16505550177").map((m) => m.body);
if (bodies.length < 2) fail(`expected Ana's "request received" and "booked" texts, got ${JSON.stringify(first)}`);
if (!bodies.some((b) => b.includes("received your request"))) fail("no request-received text");
const booked = bodies.find((b) => b.includes("is booked for"));
if (!booked) fail("no booking confirmation text");
const second = await (await fetch(outboxUrl)).json();
if (second.count !== 0) fail("the outbox returned the same texts twice");
step(`iPhone outbox returned Ana's ${bodies.length} texts, and only once`);

const link = booked.match(/https?:\/\/\S+\/a\/[0-9a-f]+/)?.[0];
if (!link) fail("no confirm link in the text");
const client = await ctx.newPage();
await client.goto(link);
await client.getByRole("button", { name: "Confirm my appointment" }).click();
await client.getByText("Confirmed. See you then!").waitFor();
await client.screenshot({ path: `${SHOTS}/A-client-confirmed.png`, fullPage: true });
step("client confirmed from the link in the text");

const ics = await (await fetch(calendarUrl)).text();
if (!ics.includes("BEGIN:VEVENT") || !ics.includes("Luna")) fail("calendar feed is missing the visit");
const bad = await fetch(calendarUrl.replace(/key=\w+/, "key=" + "0".repeat(48)));
if (bad.status !== 401) fail("calendar feed answered a wrong key");
step("calendar feed lists the visit and refuses a wrong key");

// Import a made-up export (same columns as the old app) twice: no duplicates the second time.
const { writeFileSync } = await import("node:fs");
const csvPath = `${SHOTS}/fake-export.csv`;
const header = ["First name", "Last name", "email", "Primary contact", "address", "pet(Breed)", "Last service", "Next service",
  "notes", "preferred frequency (days)", "latitude, longitude of the address"].map((h) => h + "\t");
writeFileSync(csvPath, [header.join(","),
  ['Test', 'Person', 'test@example.com', '4155550199', '"1 Elm St, San Mateo, CA, US, 94401"', '"Bo(Poodle (h)),Mo(Pug)"',
   '2026-09-01 09:00-11:00', '2027-01-05 09:00-11:00', 'Likes treats', '28', '"37.56, -122.32"'].join(",")].join("\n"));
for (const expected of ["1 clients and 2 pets imported, 1 upcoming visits.", "0 clients and 0 pets imported"]) {
  await page.goto(`${BASE}/settings/import`);
  await page.setInputFiles('input[type="file"]', csvPath);
  await page.getByRole("button", { name: "Import clients" }).click();
  await page.getByText(expected).waitFor();
}
await page.goto(`${BASE}/clients?q=Test`);
await page.getByText("Bo, Mo").waitFor();
step("CSV import: client, 2 pets and the next visit; second import adds nothing");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
