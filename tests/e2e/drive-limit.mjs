// The drive limit on the booking page, end to end. Run after slice.mjs, with DATABASE_URL.
// A time is offered only when the drive from the stop before it and to the stop after it (when
// there is one) are both within the business's drive-minute limit (35 here). The van's start ZIP
// is not a stop: distance from home is the service radius's job. Estimates: 94063 (Redwood City)
// ↔ 94611 (Piedmont) ~61 min, 94063↔94402 (San Mateo) ~19 min, 94402↔94611 ~51 min.
//   (a) D1 has a visit 09:00–11:00 at 94063: a 94611 client gets no time that day (every time is
//       next to that visit), a 94402 client does. On an empty working day (D4) 94611 gets times.
//   (b) D1 also gets a visit 14:00–16:00 at 94611: a 94402 client gets nothing between 11:00 and 14:00
//       (the next stop is too far) nor after 16:00, but still the times before 09:00 (Review Focus 3).
//   (c) A cancelled visit at 94611 on D2 does not block a 94402 client (Review Focus 2).
//   (d) A visit at an unknown ZIP (99999) on D3 blocks the times around it for any client.
//   (e) Booking requests (owner side): a pending request at 94611 on a day with the 94063 visit shows
//       "~61 min drive from the 9:00 AM visit (...)"; one at 94402 shows no warning. On a business in
//       Brazil (metric) the warning still says minutes, never km or miles. Two pending requests that
//       would sit side by side (94063 9–11, 94611 15:45 on D5) each warn about the other.
//   (f) Manual booking (owner): a 94611 client at 15:45 on D6, with a 94063 visit 9–11, gets "About 61 min
//       drive …"; "Book anyway" saves it. At 18:30 the outside-hours warning and the drive warning show together.
//       "You're already near" skips a day whose stop after the suggested time is too far (D1), keeps D4.
//   (g) A visit with no ZIP and no coordinates on D7: its visit page and its Today card say online booking is
//       closed around it; once the client's ZIP is added, the warning is gone.
// The business's limit (and country) is restored at the end, and this test's rows removed.
// Usage: node tests/e2e/drive-limit.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = postgres(process.env.DATABASE_URL);
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

const [{ biz, owner, max_drive_minutes: oldLimit, country: oldCountry }] = await db`
  select b.id as biz, s.id as owner, b.max_drive_minutes, b.country from businesses b join staff s on s.business_id = b.id
  where b.booking_slug = 'woofers' and s.role = 'owner' limit 1`;
const TZ = "America/Los_Angeles";
const la = (k) => new Date(Date.now() + k * 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });
const weekday = (d) => new Date(`${d}T12:00:00Z`).getUTCDay();
const at = (date, time) => db`select (${date}::date + ${time}::time) at time zone ${TZ} as t`.then(([r]) => r.t);
const PHONES = ["6505550171", "6505550172", "6505550173"];

const cleanUp = async () => {
  const ids = (await db`select id from clients where business_id = ${biz} and last_name = 'Drivelimit'`).map((r) => r.id);
  await db`delete from appointments where client_id = any(${ids})`;
  await db`delete from pets where client_id = any(${ids})`;
  await db`delete from clients where id = any(${ids})`;
  await db`delete from booking_drafts where business_id = ${biz} and right(phone, 10) = any(${PHONES})`;
  await db`delete from postal_points where country = 'BR' and code in ('94611', '94063')`;
  await db`update businesses set country = ${oldCountry} where id = ${biz}`;
};
await cleanUp();

// Seven free working days 10+ days ahead (seed hours: Sunday off): no visit, block or closed date.
const free = [];
for (let n = 10; free.length < 7; n++) {
  const d = la(n);
  if (weekday(d) === 0) continue;
  const { start, end } = { start: await at(d, "00:00"), end: await at(d, "23:59") };
  const [{ busy }] = await db`select
      exists (select 1 from appointments where staff_id = ${owner} and start_at < ${end} and end_at > ${start}
              and status not in ('cancelled', 'no_show', 'declined'))
   or exists (select 1 from time_off where staff_id = ${owner} and start_at < ${end} and end_at > ${start})
   or exists (select 1 from closed_dates where business_id = ${biz} and ${d}::date between start_date and end_date) as busy`;
  if (!busy) free.push(d);
}
const [D1, D2, D3, D4, D5, D6, D7] = free;

const [{ id: stopClient }] = await db`insert into clients (business_id, first_name, last_name, phone, zip)
  values (${biz}, 'Stop', 'Drivelimit', '+16505550175', '94063') returning id`;
const visit = async (date, from, to, status, zip) => db`
  insert into appointments (business_id, client_id, staff_id, start_at, end_at, status, zip)
  values (${biz}, ${stopClient}, ${owner}, ${await at(date, from)}, ${await at(date, to)}, ${status}, ${zip})`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
let page;
const button = (name) => page.getByRole("button", { name, exact: true });

// Walks a new client to "Select a time" and returns the open times (minutes after midnight) on
// each of `dates`; null when the page says there is no open time at all.
async function timesFor({ zip, city, phone }, dates) {
  // A fresh browser each time: the page remembers an unfinished booking.
  await page?.context().close();
  page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/book`);
  await page.getByLabel("Mobile phone").fill(phone);
  await button("Next").click();
  await page.getByText("It looks like your first visit with us.").waitFor();
  await page.getByLabel("First name").fill("Dee");
  await page.getByLabel("Last name").fill("Drive");
  await page.getByLabel("Email").fill("dee@example.com");
  await button("Continue").click();
  await page.getByLabel("Street address").fill("1 Oak St");
  await page.getByLabel("City").fill(city);
  await page.getByLabel("ZIP code").fill(zip);
  await button("Continue").click();
  await page.getByLabel("Breed").fill("malt");
  await button("Maltese").click();
  await page.getByLabel("Pet's name").fill("Dot");
  await page.getByRole("radio", { name: /^Small/ }).click();
  await button("Save Dot").click();
  await button("Continue to service").click();
  await page.getByRole("radiogroup", { name: "Category" }).getByRole("radio", { name: "Bath", exact: true }).click();
  await page.getByRole("radiogroup", { name: "Service" }).getByRole("radio").first().click();
  await button("Continue").click();
  await page.getByRole("radio", { name: "No", exact: true }).click();
  await button("Confirm info for Dot").click();
  const heading = page.getByRole("heading", { name: "Select a time" });
  const none = page.getByText("No open times in your area right now.");
  await heading.or(none).waitFor();
  if (await none.isVisible()) return null;

  const out = {};
  for (const date of dates) {
    const month = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    // Forward or back to that month (the calendar may already be past it, near a month's end).
    const want = date.slice(0, 7);
    for (let i = 0; i < 13 && (await page.getByRole("heading", { name: month, exact: true }).count()) === 0; i++) {
      const shown = await page.getByRole("heading", { name: /^[A-Z][a-z]+ \d{4}$/ }).first().textContent();
      const [name, year] = shown.trim().split(" ");
      const m = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(name) + 1;
      const showing = `${year}-${String(m).padStart(2, "0")}`;
      await button(showing < want ? "Next month" : "Previous month").click();
    }
    const label = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
    const cell = page.locator(`button[aria-label^="${label}, "]`);
    if (await cell.isDisabled()) {
      out[date] = [];
      continue;
    }
    await cell.click();
    const texts = await page.getByRole("group", { name: "Open times" }).locator("button").allInnerTexts();
    out[date] = texts.map((t) => {
      const [, h, m, ap] = t.match(/(\d+):(\d+)\s*([AP]M)/i);
      return ((Number(h) % 12) + (/p/i.test(ap) ? 12 : 0)) * 60 + Number(m);
    });
  }
  return out;
}
const hhmm = (list) => list.map((m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`).join(" ");
const PIEDMONT = { zip: "94611", city: "Piedmont" };
const SAN_MATEO = { zip: "94402", city: "San Mateo" };

try {
  await db`update businesses set max_drive_minutes = 35 where id = ${biz}`;
  await visit(D1, "09:00", "11:00", "confirmed", "94063");
  await visit(D2, "11:00", "13:00", "cancelled", "94611");
  await visit(D3, "11:00", "13:00", "confirmed", "99999");

  // (a) Piedmont is ~61 min from the Redwood City visit; an empty day is open to it.
  const piedmont = await timesFor({ ...PIEDMONT, phone: PHONES[0] }, [D1, D2, D3, D4]);
  if (!piedmont) fail("94611 should see open times on days without a far stop");
  if (piedmont[D1].length) fail(`94611 was offered ${D1} (${hhmm(piedmont[D1])}), which has a Redwood City visit`);
  step(`(a) 94611 client: nothing on ${D1} (Redwood City visit 9–11)`);
  if (!piedmont[D4].length) fail(`94611 should see times on the empty day ${D4}`);
  step(`(a) 94611 client: the empty day ${D4} offers ${hhmm(piedmont[D4])}`);
  if (!piedmont[D2].includes(11 * 60)) fail(`a cancelled 94611 visit is not a stop: 94611 should get 11:00 on ${D2}, got ${hhmm(piedmont[D2])}`);
  if (piedmont[D3].length) fail(`(d) the unknown ZIP must block 94611 too on ${D3}, got ${hhmm(piedmont[D3])}`);
  step(`(c) 94611 is offered ${D2} like an empty day; (d) nothing on ${D3}`);

  // (a), (c), (d) for San Mateo, ~19 min from Redwood City.
  const sm = await timesFor({ ...SAN_MATEO, phone: PHONES[1] }, [D1, D2, D3]);
  if (!sm) fail("94402 should see open times");
  if (!sm[D1].length) fail(`94402 should see times on ${D1}`);
  step(`(a) 94402 client: ${D1} offers ${hhmm(sm[D1])}`);
  if (!sm[D2].includes(11 * 60)) fail(`a cancelled 94611 visit must not block 94402 on ${D2}, got ${hhmm(sm[D2])}`);
  step(`(c) cancelled 94611 visit on ${D2} doesn't count: 94402 is offered ${hhmm(sm[D2])}`);
  if (sm[D3].length) fail(`a visit at an unknown ZIP must block the times around it on ${D3}, got ${hhmm(sm[D3])}`);
  step(`(d) visit at unknown ZIP 99999 on ${D3}: no times for 94402`);

  // (b) A Piedmont visit 14–16 the same day: San Mateo can't sit between Redwood City and Piedmont.
  await visit(D1, "14:00", "16:00", "confirmed", "94611");
  const between = await timesFor({ ...SAN_MATEO, phone: PHONES[2] }, [D1]);
  const d1 = between?.[D1] ?? [];
  if (d1.some((m) => m >= 11 * 60 && m < 14 * 60)) fail(`94402 was offered a time between 11:00 and 14:00 on ${D1}: ${hhmm(d1)}`);
  if (d1.some((m) => m >= 16 * 60)) fail(`94402 was offered a time after the Piedmont visit on ${D1}: ${hhmm(d1)}`);
  if (!d1.some((m) => m < 9 * 60)) fail(`94402 should still see the times before 9:00 on ${D1}, got ${hhmm(d1)}`);
  step(`(b) between Redwood City (9–11) and Piedmont (14–16): 94402 only gets ${hhmm(d1)}`);

  // (e) The request card on the owner's Requests screen.
  const request = async (date, from, to, zip) => {
    const [{ id }] = await db`insert into appointments (business_id, client_id, staff_id, start_at, end_at, status, zip)
      values (${biz}, ${stopClient}, ${owner}, ${await at(date, from)}, ${await at(date, to)}, 'requested', ${zip}) returning id`;
    return id;
  };
  await visit(D2, "09:00", "11:00", "confirmed", "94063");
  const far = await request(D2, "13:00", "15:00", "94611");
  await visit(D4, "09:00", "11:00", "confirmed", "94063");
  const near = await request(D4, "13:00", "15:00", "94402");

  await page?.context().close();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', "owner@example.com");
  await page.fill('input[name="password"]', "correct horse battery");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/today/);
  const warningOn = async (id, re = /min drive from the/) => {
    await page.goto(`${BASE}/requests`);
    const card = page.locator(`a[href="/appointments/${id}"]`).locator("xpath=..").locator("xpath=..");
    await card.waitFor();
    const w = card.getByText(re);
    return (await w.count()) ? await w.innerText() : null;
  };
  const farWarning = await warningOn(far);
  if (!farWarning || !/~61 min drive from the 9:00 AM visit \(Redwood City\)/.test(farWarning)) fail(`94611 request: expected the 61 min warning, got ${farWarning}`);
  step(`(e) 94611 request next to the Redwood City visit: "${farWarning}"`);
  const nearWarning = await warningOn(near);
  if (nearWarning) fail(`94402 request should have no warning, got ${nearWarning}`);
  step("(e) 94402 request: no warning");

  // A neighbor whose ZIP can't be placed (99999 on D3) is not waved through: the card says so.
  const unknown = await request(D3, "14:00", "16:00", "94402");
  const unknownWarning = await warningOn(unknown, /Can't estimate the drive from Stop's visit/);
  if (!unknownWarning) fail("a request next to a visit at an unknown ZIP should say the drive can't be estimated");
  step(`(e) request next to the unknown-ZIP visit: "${unknownWarning}"`);

  // Two pending requests next to each other: each card counts the other as its neighbor.
  const reqA = await request(D5, "09:00", "11:00", "94063");
  const reqB = await request(D5, "15:45", "17:45", "94611");
  const wA = await warningOn(reqA);
  if (!wA || !/~61 min drive from the 3:45 PM visit/.test(wA)) fail(`the 94063 request should warn about the 94611 request at 3:45 PM, got ${wA}`);
  const wB = await warningOn(reqB);
  if (!wB || !/~61 min drive from the 9:00 AM visit/.test(wB)) fail(`the 94611 request should warn about the 94063 request at 9:00 AM, got ${wB}`);
  step(`(e) two pending requests side by side both warn: "${wA}" / "${wB}"`);

  // (f) Manual booking: the drive warning, together with any other warning; "Book anyway" saves.
  const [{ id: farClient }] = await db`insert into clients (business_id, first_name, last_name, phone, zip, city)
    values (${biz}, 'Far', 'Drivelimit', '+16505550186', '94611', 'Piedmont') returning id`;
  await db`insert into pets (client_id, name, size_class) values (${farClient}, 'Fardog', 'small')`;
  await visit(D6, "09:00", "11:00", "confirmed", "94063");
  const book = async (time) => {
    await page.goto(`${BASE}/appointments/new?client=${farClient}&date=${D6}&time=${time}`);
    const pet = page.locator('input[name="pet"]');
    if (!(await pet.isChecked())) await pet.check();
    const svc = page.locator('select[name^="svc:"]');
    await svc.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Book appointment" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.waitFor();
    return dialog.innerText();
  };
  const both = await book("18:30");
  if (!/outside working hours/.test(both) || !/About 61 min drive from Stop's visit \(limit 35 min\)/.test(both)) {
    fail(`at 18:30 the outside-hours and the drive warnings should show together, got: ${both}`);
  }
  step("(f) manual booking at 6:30 PM: outside hours and the drive warning, together");
  const drive = await book("15:45");
  if (!/About 61 min drive from Stop's visit \(limit 35 min\)/.test(drive)) fail(`manual booking at 15:45 should warn about the drive, got: ${drive}`);
  await page.getByRole("button", { name: "Book anyway" }).click();
  await page.waitForURL(/\?booked=1/);
  const [{ n: booked }] = await db`select count(*)::int as n from appointments where client_id = ${farClient}`;
  if (booked !== 1) fail(`Book anyway should save the visit, found ${booked}`);
  step(`(f) manual booking at 3:45 PM: "${drive.match(/About[^.]*\./)?.[0]}"; Book anyway saves it`);

  // (f) "You're already near" on the owner's booking form: a day is suggested only when the visit after
  // the suggested time is within the limit too. D1: Redwood City 9–11 (~19 min from 94402), then Piedmont
  // 14–16 (~51 min): not suggested. D4: Redwood City 9–11, then a 94402 request at 13:00: suggested.
  const [{ id: midClient }] = await db`insert into clients (business_id, first_name, last_name, phone, zip, city)
    values (${biz}, 'Mid', 'Drivelimit', '+16505550189', '94402', 'San Mateo') returning id`;
  await db`insert into pets (client_id, name, size_class) values (${midClient}, 'Middog', 'small')`;
  await page.goto(`${BASE}/appointments/new?client=${midClient}`);
  const nearBox = page.locator("section", { has: page.getByRole("heading", { name: /You're already near Mid on/ }) });
  await nearBox.waitFor({ timeout: 8000 }).catch(() => fail("the booking form should list days near Mid"));
  if (!(await nearBox.locator(`a[href*="date=${D4}&"]`).count())) fail(`${D4} (Redwood City, then a 94402 request) should be suggested`);
  if (await nearBox.locator(`a[href*="date=${D1}&"]`).count()) fail(`${D1} should not be suggested: Piedmont 14–16 is too far from the time after 11:00`);
  step(`(f) "already near" suggests ${D4} but not ${D1} (the stop after the suggested time is too far)`);

  // (g) A visit with no ZIP and no coordinates blocks online times around it; the owner is told why.
  const [{ id: noZipClient }] = await db`insert into clients (business_id, first_name, last_name, phone)
    values (${biz}, 'Nozip', 'Drivelimit', '+16505550187') returning id`;
  const [{ id: noZipVisit }] = await db`insert into appointments (business_id, client_id, staff_id, start_at, end_at, status, zip)
    values (${biz}, ${noZipClient}, ${owner}, ${await at(D7, "10:00")}, ${await at(D7, "12:00")}, 'confirmed', null) returning id`;
  const NO_ZIP = "No ZIP code: online booking is closed around this visit. Add the ZIP to the client's address.";
  await page.goto(`${BASE}/appointments/${noZipVisit}`);
  await page.getByText(NO_ZIP).first().waitFor({ timeout: 8000 }).catch(() => fail("the visit page should say the visit has no ZIP"));
  await page.goto(`${BASE}/today?date=${D7}`);
  await page.locator(`a[href="/appointments/${noZipVisit}"]`).first().waitFor();
  await page.getByText(NO_ZIP).first().waitFor({ timeout: 8000 }).catch(() => fail("the Today card should say the visit has no ZIP"));
  step("(g) a visit with no ZIP: its visit page and Today card say online booking is closed around it");
  await page.goto(`${BASE}/clients/${noZipClient}/edit`);
  await page.locator('input[name="zip"]').fill("94402");
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL((u) => u.pathname === `/clients/${noZipClient}`);
  await page.goto(`${BASE}/appointments/${noZipVisit}`);
  await page.getByRole("heading").first().waitFor();
  if (await page.getByText(NO_ZIP).count()) fail("after adding the client's ZIP, the visit should no longer warn");
  const [{ zip: visitZip }] = await db`select zip from appointments where id = ${noZipVisit}`;
  if (visitZip !== "94402") fail(`the upcoming visit should take the client's new ZIP, got ${visitZip}`);
  step("(g) adding the client's ZIP fills it on the upcoming visit; the warning is gone");

  // Metric business: still minutes. The postal codes must be known for Brazil, so seed them for the test.
  await db`update businesses set country = 'BR' where id = ${biz}`;
  await db`insert into postal_points (country, code, lat, lng, city) values
    ('BR', '94611', 37.8471, -122.2223, 'Oakland'), ('BR', '94063', 37.4815, -122.2091, 'Redwood City')
    on conflict (country, code) do nothing`;
  const brWarning = await warningOn(far);
  if (!brWarning || !/61 min/.test(brWarning) || /\b(km|mi|miles)\b/i.test(brWarning)) fail(`metric business: expected minutes only, got ${brWarning}`);
  step(`(e) metric business: "${brWarning}"`);

  if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
} finally {
  await db`update businesses set max_drive_minutes = ${oldLimit} where id = ${biz}`;
  await cleanUp();
  await browser.close();
  await db.end();
}
console.log("All good.");
