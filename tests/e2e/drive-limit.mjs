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
//       Brazil (metric) the warning still says minutes, never km or miles.
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
  await db`delete from clients where id = any(${ids})`;
  await db`delete from booking_drafts where business_id = ${biz} and right(phone, 10) = any(${PHONES})`;
  await db`delete from postal_points where country = 'BR' and code in ('94611', '94063')`;
  await db`update businesses set country = ${oldCountry} where id = ${biz}`;
};
await cleanUp();

// Four free working days 10+ days ahead (seed hours: Sunday off): no visit, block or closed date.
const free = [];
for (let n = 10; free.length < 4; n++) {
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
const [D1, D2, D3, D4] = free;

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
    for (let i = 0; i < 13 && (await page.getByRole("heading", { name: month, exact: true }).count()) === 0; i++) {
      await button("Next month").click();
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
