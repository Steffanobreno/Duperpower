// The groomer on the online booking page, end to end. Run after slice.mjs. Needs DATABASE_URL.
// One groomer takes online bookings → the times screen shows "Your groomer" with the name →
// a second groomer (other hours) is added → the client chooses them, sees their times, books,
// and the visit is theirs → turning "Takes online bookings" off in Team hides them again.
// Usage: node tests/e2e/booking-groomer.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = postgres(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/woofers", { max: 1 });
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
const button = (name) => page.getByRole("button", { name, exact: true });

const [biz] = await db`select id from businesses where booking_slug = 'woofers'`;
const [owner] = await db`select id, name from staff where business_id = ${biz.id} and role = 'owner'`;

// A new client walks to the times screen.
async function toTimes(phone) {
  await page.goto(`${BASE}/book`);
  await page.getByLabel("Mobile phone").fill(phone);
  await button("Next").click();
  await page.getByLabel("First name").fill("Gia");
  await page.getByLabel("Last name").fill("Rossi");
  await page.getByLabel("Email").fill("gia@example.com");
  await button("Continue").click();
  await page.getByLabel("Street address").fill("1 Main St");
  await page.getByLabel("City").fill("Palo Alto");
  await page.getByLabel("ZIP code").fill("94301");
  await button("Continue").click();
  await page.getByLabel("Breed").fill("malt");
  await button("Maltese").click();
  await page.getByLabel("Pet's name").fill("Nico");
  await page.getByRole("radio", { name: /^Small/ }).click();
  await button("Save Nico").click();
  await button("Continue to service").click();
  await page.getByRole("radiogroup", { name: "Category" }).getByRole("radio", { name: "Bath", exact: true }).click();
  await page.getByRole("radiogroup", { name: "Service" }).getByRole("radio").first().click();
  await button("Continue").click();
  await page.getByRole("radio", { name: "No", exact: true }).click();
  await button("Confirm info for Nico").click();
  await page.getByRole("heading", { name: "Select a time" }).waitFor();
}
const firstTimes = () => page.getByRole("group", { name: "Open times" }).locator("button").allTextContents();

// 1. One groomer: their name is shown before the times, nothing to choose.
await toTimes("6505550181");
await page.getByText("Your groomer").waitFor();
await page.getByText(owner.name, { exact: true }).waitFor();
if (await page.getByRole("radiogroup", { name: "Choose your groomer" }).count()) fail("with one groomer there is nothing to choose");
step(`one groomer: the times screen shows "Your groomer: ${owner.name}"`);

// 2. A second groomer who works afternoons only (1 PM to 3 PM).
const [luna] = await db`insert into staff (business_id, name, role, color) values (${biz.id}, 'Luna', 'groomer', '#1f9d55') returning id`;
await db`insert into working_hours (staff_id, weekday, start_time, end_time)
         select ${luna.id}, weekday, '13:00', '15:00' from working_hours where staff_id = ${owner.id}`;
await toTimes("6505550182");
const choose = page.getByRole("radiogroup", { name: "Choose your groomer" });
if ((await choose.getByRole("radio").count()) !== 2) fail("both groomers should be offered");
if ((await choose.getByRole("radio", { checked: true }).textContent()).trim().endsWith(owner.name) === false) fail("the owner should be picked to start with");
await choose.getByRole("radio", { name: /Luna/ }).click();
await page.getByText("The open times below are Luna's.").waitFor();
await page.waitForFunction(() => [...document.querySelectorAll('[role="group"][aria-label="Open times"] button')].length > 0);
const times = await firstTimes();
if (!times.length || times.some((x) => !/^(⭐ )?(1|2):\d\d PM$/.test(x.trim()))) fail(`Luna's times should all be between 1 and 3 PM: ${times}`);
step("two groomers: the client chooses, and sees only that groomer's times");

// 3. Book with Luna: the review names her and the visit is hers.
await page.getByRole("group", { name: "Open times" }).locator("button").first().click();
await page.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
if (await page.getByRole("button", { name: /Read and sign/ }).count()) {
  await page.getByRole("button", { name: /Read and sign/ }).click();
  await page.getByLabel("I have read and agree to the service agreement.").check();
  await page.getByLabel("Type your full name to sign").fill("Gia Rossi");
  const pad = page.getByLabel("Draw your signature here");
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  await page.mouse.move(box.x + 30, box.y + 60);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 30 + i * 18, box.y + 60 + (i % 2 ? 25 : -25));
  await page.mouse.up();
  await button("Sign agreement").click();
}
await page.getByText("Groomer", { exact: true }).waitFor();
await page.getByText("Luna", { exact: true }).waitFor();
await button("Submit booking request").click();
await page.getByText(/Waiting for confirmation|You're booked|booked/i).first().waitFor();
const [appt] = await db`select a.staff_id from appointments a join clients c on c.id = a.client_id
                        where c.phone like '%6505550182' order by a.created_at desc limit 1`;
if (appt?.staff_id !== luna.id) fail("the visit should be Luna's");
step("the review shows the groomer, and the booked visit is theirs");

// 4. Team → Luna → "Takes online bookings" off: the booking page shows one groomer again.
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
await page.goto(`${BASE}/settings/team/${luna.id}`);
await page.getByLabel(/Takes online bookings/).uncheck();
await page.getByRole("button", { name: "Save" }).first().click();
await page.waitForURL(/\/settings\/team$/);
const [{ online_booking }] = await db`select online_booking from staff where id = ${luna.id}`;
if (online_booking) fail("the switch should be saved");
await page.context().clearCookies();
await toTimes("6505550183");
await page.getByText("Your groomer").waitFor();
if (await page.getByRole("radiogroup", { name: "Choose your groomer" }).count()) fail("Luna shouldn't be offered any more");
step("Team: turning “Takes online bookings” off takes the groomer off the booking page");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await db.end();
await browser.close();
console.log("booking-groomer: all good");
