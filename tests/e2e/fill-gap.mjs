// Fill the gap, end to end. Run after slice.mjs, with DATABASE_URL.
// A working day 10 days ahead has a block 07:00–09:00 and one visit 09:00–11:00 at 94401. Clients A (94402) and B (94010)
// are due; C is due but already booked 12 days ahead; A2 is due but already rebooked (25 days after
// the day); E is due but blocked from online booking; D is on the waitlist for the day.
// /fill/<day> shows the free time and D, A, B in that order (not C), with the gap offer ready to send;
// tapping WhatsApp records the invite (once). A groomer without "See client phone numbers"
// sees the list but no send links.
// Usage: node tests/e2e/fill-gap.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";
import postgres from "postgres";
import { randomBytes, scryptSync } from "node:crypto";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const db = postgres(process.env.DATABASE_URL);
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

const [{ biz, owner }] = await db`select b.id as biz, s.id as owner from businesses b join staff s on s.business_id = b.id
  where b.booking_slug = 'woofers' and s.role = 'owner' limit 1`;
const la = (k) => new Date(Date.now() + k * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const weekday = (d) => new Date(`${d}T12:00:00Z`).getUTCDay();
// A working day about 10 days ahead (seed hours: Sunday off), and a Sunday.
let n = 10;
while (weekday(la(n)) === 0 || (await db`select 1 from closed_dates where business_id = ${biz} and ${la(n)}::date between start_date and end_date`).length) n++;
const DAY = la(n);
let s = 1;
while (weekday(la(s)) !== 0) s++;
const SUNDAY = la(s);
const at = (k, time) => db`select (${la(k)}::date + ${time}::time) at time zone 'America/Los_Angeles' as t`.then(([r]) => r.t);

// This test's clients, visits and block go away at the start (an earlier run that stopped halfway)
// and at the end, so the next tests (waitlist.mjs: "Nobody is waiting") see the day as before.
const GROOMER_EMAIL = "gapfill-groomer@example.com";
const GROOMER_PASSWORD = "gapfill-groomer-pw";
const cleanUp = async () => {
  await db`delete from staff where business_id = ${biz} and name = 'Gapfill Groomer'`;
  await db`delete from users where email = ${GROOMER_EMAIL}`;
  // The groomer role's default (on), which the permission step turns off for a moment; also after a run that stopped there.
  await db`insert into role_permissions (business_id, role, perm) values (${biz}, 'groomer', 'client_contact') on conflict do nothing`;
  const ids = (await db`select id from clients where business_id = ${biz} and last_name = 'Gapfill'`).map((r) => r.id);
  await db`delete from appointments where client_id = any(${ids})`;
  await db`delete from clients where id = any(${ids})`;
  await db`delete from time_off where staff_id = ${owner} and reason = 'Gapfill'`;
};
await cleanUp();

const client = async (first, zip) => {
  const phone = `+1650555${String(Math.floor(Math.random() * 10_000)).padStart(4, "0")}`;
  const [{ id }] = await db`insert into clients (business_id, first_name, last_name, phone, zip, sms_consent_at)
    values (${biz}, ${first}, 'Gapfill', ${phone}, ${zip}, now()) returning id`;
  await db`insert into pets (client_id, name, size_class, rebook_every_days) values (${id}, ${first + "dog"}, 'medium', 42)`;
  return id;
};
const visit = async (clientId, k, from, to, status, zip) => {
  await db`insert into appointments (business_id, client_id, staff_id, start_at, end_at, status, zip)
    values (${biz}, ${clientId}, ${owner}, ${await at(k, from)}, ${await at(k, to)}, ${status}, ${zip})`;
};

const stop = await client("Stop", "94401");
await visit(stop, n, "09:00", "11:00", "confirmed", "94401");
// A block before it (van at the shop), so the first free time, the one offered, is 11:00.
await db`insert into time_off (staff_id, start_at, end_at, reason) values (${owner}, ${await at(n, "07:00")}, ${await at(n, "09:00")}, 'Gapfill')`;
const A = await client("Avery", "94402");
const B = await client("Blake", "94010");
const C = await client("Casey", "94402");
const A2 = await client("Ari", "94402");
const D = await client("Dana", "94401");
// B never agreed to texts.
await db`update clients set sms_consent_at = null where id = ${B}`;
// E is due but blocked from booking online: never invited.
const E = await client("Eli", "94402");
await db`update clients set online_booking_blocked = true where id = ${E}`;
for (const id of [A, B, C, A2, E]) await visit(id, -50, "10:00", "12:00", "completed", null);
await visit(C, n + 12, "10:00", "12:00", "confirmed", "94402");
await visit(A2, n + 25, "10:00", "12:00", "confirmed", "94402");
await db`update pets set rebook_every_days = null where client_id = ${D}`;
await db`insert into waitlist (business_id, client_id, from_date, to_date) values (${biz}, ${D}, ${DAY}, ${DAY})`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

await page.goto(`${BASE}/fill/${DAY}`);
await page.getByRole("heading", { name: /^Fill / }).waitFor();
const chips = await page.locator('section[aria-label="Free time"] li').allTextContents();
if (!/^11:00/.test(chips[0] ?? "")) fail(`the first gap should start at 11:00, got ${chips.join(", ")}`);
step(`the free time after the block and the 09:00–11:00 visit: ${chips.join(", ")}`);

const rows = await page.locator("li[data-client]").evaluateAll((els) => els.map((e) => e.getAttribute("data-client")));
const row = (id) => page.locator(`li[data-client="${id}"]`);
if (rows[0] !== D) fail("the waitlisted client should come first");
await row(D).getByText("On the waitlist").waitFor();
if (!(rows.indexOf(A) > 0 && rows.indexOf(B) > rows.indexOf(A))) fail(`A (94402) should come before B (94010): ${rows.indexOf(A)}, ${rows.indexOf(B)}`);
await row(A).getByText(/\d+ days overdue/).waitFor();
if (rows.includes(C)) fail("C has a visit 12 days later and should not be invited");
if (rows.includes(A2)) fail("A2 already rebooked (25 days later) and should not be invited");
if (rows.includes(stop)) fail("the client booked that day should not be invited");
if (rows.includes(E)) fail("E is blocked from online booking and should not be invited");
step("D (waitlist) first, then A before B (closer to the stop); C (booked soon), A2 (rebooked) and E (blocked) left out");

const wa = row(A).getByRole("link", { name: "WhatsApp" });
const href = await wa.getAttribute("href");
if (!href.includes("wa.me/") || !href.includes(encodeURIComponent("11:00"))) fail(`WhatsApp link should offer 11:00: ${href}`);
if (!decodeURIComponent(href).includes("Hi Avery!")) fail(`the offer should greet Avery: ${decodeURIComponent(href)}`);
step("A's WhatsApp link has the gap offer for 11:00");

// A gap offer is promotional: a text only to clients who agreed to texts (B didn't); WhatsApp stays.
if (!(await row(A).locator('a[href^="sms:"]').count())) fail("A agreed to texts and should have a Text link");
if (await row(B).locator('a[href^="sms:"]').count()) fail("B never agreed to texts and should have no Text link");
await row(B).getByRole("link", { name: "WhatsApp" }).waitFor();
step("Text only for clients who agreed to texts (A); B, who didn't, keeps WhatsApp");

// The link opens WhatsApp in a new tab; the tap also records the invite.
await context.route("https://wa.me/**", (r) => r.fulfill({ body: "WhatsApp" }));
const tap = async () => {
  const [popup] = await Promise.all([page.waitForEvent("popup"), wa.click()]);
  await popup.close();
};
const offerCount = async () =>
  (await db`select count(*)::int as n from fill_offers where client_id = ${A} and day = ${DAY}`)[0].n;
await tap();
let offers = 0;
for (let i = 0; i < 50 && !offers; i++) {
  offers = await offerCount();
  if (!offers) await page.waitForTimeout(100);
}
if (offers !== 1) fail(`one invite should be recorded, got ${offers}`);
// A second tap (e.g. Text, then WhatsApp) is the same invite.
await tap();
await page.waitForTimeout(1500);
if ((offers = await offerCount()) !== 1) fail(`a second tap should not count again, got ${offers}`);
await page.reload();
await row(A).getByText("Invited today").waitFor();
if (await row(B).getByText("Invited today").count()) fail("only A was invited");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/F01-fill-gap.png`, fullPage: true });
step("tapping WhatsApp opens it and records the invite once; A shows Invited today");

// A groomer without "See client phone numbers and emails": the rows, but no phone links.
{
  const salt = randomBytes(16);
  // The same format as hashPassword in src/lib/auth.ts (which can't be imported outside Next).
  const hash = `scrypt$${salt.toString("base64")}$${scryptSync(GROOMER_PASSWORD, salt, 64).toString("base64")}`;
  const [{ id: user }] = await db`insert into users (email, password_hash) values (${GROOMER_EMAIL}, ${hash}) returning id`;
  const [{ id: groomer }] = await db`insert into staff (business_id, name, role, user_id) values (${biz}, 'Gapfill Groomer', 'groomer', ${user}) returning id`;
  await db`insert into working_hours (staff_id, weekday, start_time, end_time) values (${groomer}, ${weekday(DAY)}, '07:00', '19:00')`;
  await db`delete from role_permissions where business_id = ${biz} and role = 'groomer' and perm = 'client_contact'`;
  const g = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  g.on("pageerror", (e) => errors.push(e.message));
  await g.goto(`${BASE}/login`);
  await g.fill('input[name="email"]', GROOMER_EMAIL);
  await g.fill('input[name="password"]', GROOMER_PASSWORD);
  await g.click('button[type="submit"]');
  await g.waitForURL(/\/today/);
  await g.goto(`${BASE}/fill/${DAY}`);
  await g.locator(`li[data-client="${A}"]`).waitFor();
  const links = await g.locator('li[data-client] a[href^="https://wa.me/"], li[data-client] a[href^="sms:"]').count();
  if (links) fail(`a groomer without client contact should see no WhatsApp/Text links, got ${links}`);
  await g.context().close();
  step("a groomer without client contact sees the list but no WhatsApp/Text links");
}

await page.goto(`${BASE}/fill/${SUNDAY}`);
await page.getByText("No free time this day.").waitFor();
step("a Sunday (day off) has no free time");

// A working day that has passed: nothing to fill, nobody to invite.
let p = -3;
while (weekday(la(p)) === 0 || (await db`select 1 from closed_dates where business_id = ${biz} and ${la(p)}::date between start_date and end_date`).length) p--;
await page.goto(`${BASE}/fill/${la(p)}`);
await page.getByText("No free time this day.").waitFor();
if (await page.locator("li[data-client]").count()) fail("a past day should invite nobody");
step("a past working day shows no free time and no invites");

// With the owner loading screen the status is already sent (200), so check the page says "not found" (as fixes.mjs does).
for (const bad of ["not-a-date", "2026-02-31"]) {
  await page.goto(`${BASE}/fill/${bad}`);
  await page.getByText(/could not be found|not found/i).first().waitFor({ timeout: 10_000 });
  if (await page.getByText(/That took too long|Try again/).count()) fail(`/fill/${bad} shows the error page`);
}
step("a bad date shows the not-found page");

// Today's card for the day, and a cancelled future visit points back to the same day.
await page.goto(`${BASE}/today?date=${DAY}`);
const card = page.getByRole("link", { name: /\d+ free slots · \d+ clients nearby/ });
await card.waitFor();
if (!(await card.getAttribute("href")).endsWith(`/fill/${DAY}`)) fail("the Today card should link to /fill/<day>");
step("Today shows the free slots card linking to /fill/<day>");
// Map mode with a stop: the chip sits over the map, and the visit cards stay above the tab bar.
await page.getByRole("img", { name: "Map of the day's visits" }).waitFor();
if (!(await page.locator('[aria-label="Visits"]').count())) fail("the day's visit cards should show in map mode");
const mapGap = await page.evaluate(() =>
  document.querySelector('nav[aria-label="Main"]').getBoundingClientRect().top - document.querySelector('[aria-label="Visits"]').getBoundingClientRect().bottom);
if (mapGap < 0) fail(`the cards are ${-mapGap}px under the tab bar`);
step("map mode with free time: the chip is shown and the visit cards stay above the tab bar");
const [{ id: stopVisit }] = await db`select id from appointments where client_id = ${stop} and status = 'confirmed'`;
await page.goto(`${BASE}/appointments/${stopVisit}`);
if (await page.getByRole("link", { name: /Fill this time/ }).count()) fail("a confirmed visit should not offer Fill this time");
await db`update appointments set status = 'cancelled' where id = ${stopVisit}`;
await page.goto(`${BASE}/appointments/${stopVisit}`);
const fillLink = page.getByRole("link", { name: /Fill this time/ });
await fillLink.waitFor();
if (!(await fillLink.getAttribute("href")).endsWith(`/fill/${DAY}`)) fail("Fill this time should link to /fill/<day>");
step("a cancelled future visit shows Fill this time linking to /fill/<day>");

await cleanUp();
await db.end();
await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
