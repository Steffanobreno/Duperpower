// Fill the gap, end to end. Run after slice.mjs, with DATABASE_URL.
// A working day 10 days ahead has a block 07:00–09:00 and one visit 09:00–11:00 at 94401. Clients A (94402) and B (94010)
// are due; C is due but already booked 12 days ahead; D is on the waitlist for the day.
// /fill/<day> shows the free time and D, A, B in that order (not C), with the gap offer ready to send;
// tapping WhatsApp records the invite.
// Usage: node tests/e2e/fill-gap.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";
import postgres from "postgres";

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
const cleanUp = async () => {
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
const D = await client("Dana", "94401");
for (const id of [A, B, C]) await visit(id, -50, "10:00", "12:00", "completed", null);
await visit(C, n + 12, "10:00", "12:00", "confirmed", "94402");
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
if (rows.includes(stop)) fail("the client booked that day should not be invited");
step("D (waitlist) first, then A before B (closer to the stop); C (booked soon) left out");

const wa = row(A).getByRole("link", { name: "WhatsApp" });
const href = await wa.getAttribute("href");
if (!href.includes("wa.me/") || !href.includes(encodeURIComponent("11:00"))) fail(`WhatsApp link should offer 11:00: ${href}`);
if (!decodeURIComponent(href).includes("Hi Avery!")) fail(`the offer should greet Avery: ${decodeURIComponent(href)}`);
step("A's WhatsApp link has the gap offer for 11:00");

// The link opens WhatsApp in a new tab; the tap also records the invite.
await context.route("https://wa.me/**", (r) => r.fulfill({ body: "WhatsApp" }));
const [popup] = await Promise.all([page.waitForEvent("popup"), wa.click()]);
await popup.close();
let offers = 0;
for (let i = 0; i < 50 && !offers; i++) {
  [{ offers }] = await db`select count(*)::int as offers from fill_offers where client_id = ${A} and day = ${DAY}`;
  if (!offers) await page.waitForTimeout(100);
}
if (offers !== 1) fail(`one invite should be recorded, got ${offers}`);
await page.reload();
await row(A).getByText("Invited today").waitFor();
if (await row(B).getByText("Invited today").count()) fail("only A was invited");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/F01-fill-gap.png`, fullPage: true });
step("tapping WhatsApp opens it and records the invite; A shows Invited today");

await page.goto(`${BASE}/fill/${SUNDAY}`);
await page.getByText("No free time this day.").waitFor();
step("a Sunday (day off) has no free time");

// With the owner loading screen the status is already sent (200), so check the page says "not found" (as fixes.mjs does).
for (const bad of ["not-a-date", "2026-02-31"]) {
  await page.goto(`${BASE}/fill/${bad}`);
  await page.getByText(/could not be found|not found/i).first().waitFor({ timeout: 10_000 });
  if (await page.getByText(/That took too long|Try again/).count()) fail(`/fill/${bad} shows the error page`);
}
step("a bad date shows the not-found page");

await cleanUp();
await db.end();
await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
