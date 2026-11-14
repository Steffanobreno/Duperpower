// The drive limit on the booking page, end to end. Run after slice.mjs, with DATABASE_URL.
// A time is offered only when the drive from the stop before it (or the van's start ZIP) and to
// the stop after it are both within the business's drive-minute limit (35 here). The van starts
// in Redwood City (94063). Estimates: 94063↔94611 (Piedmont) ~61 min, 94063↔94402 (San Mateo)
// ~19 min, 94402↔94611 ~51 min.
//   (a) D1 has a visit 09:00–11:00 at 94063: a 94611 client gets no time that day, a 94402 client does.
//       With no start ZIP set, that side passes (Review Focus 1): 94611 then sees other days, still not D1.
//   (b) D1 also gets a visit 14:00–16:00 at 94611: a 94402 client gets nothing between 11:00 and 14:00
//       (the next stop is too far) nor after 16:00, but still the times before 09:00 (Review Focus 3).
//   (c) A cancelled visit at 94611 on D2 does not block a 94402 client (Review Focus 2).
//   (d) A visit at an unknown ZIP (99999) on D3 blocks the times around it for any client.
// The business's start ZIP and limit are restored at the end, and this test's rows removed.
// Usage: node tests/e2e/drive-limit.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = postgres(process.env.DATABASE_URL);
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

const [{ biz, owner, start_zip: oldStartZip, max_drive_minutes: oldLimit }] = await db`
  select b.id as biz, s.id as owner, b.start_zip, b.max_drive_minutes from businesses b join staff s on s.business_id = b.id
  where b.booking_slug = 'woofers' and s.role = 'owner' limit 1`;
const TZ = "America/Los_Angeles";
const la = (k) => new Date(Date.now() + k * 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });
const weekday = (d) => new Date(`${d}T12:00:00Z`).getUTCDay();
const at = (date, time) => db`select (${date}::date + ${time}::time) at time zone ${TZ} as t`.then(([r]) => r.t);
const PHONES = ["6505550171", "6505550172", "6505550173", "6505550174"];

const cleanUp = async () => {
  const ids = (await db`select id from clients where business_id = ${biz} and last_name = 'Drivelimit'`).map((r) => r.id);
  await db`delete from appointments where client_id = any(${ids})`;
  await db`delete from clients where id = any(${ids})`;
  await db`delete from booking_drafts where business_id = ${biz} and right(phone, 10) = any(${PHONES})`;
};
await cleanUp();

// Three free working days 10+ days ahead (seed hours: Sunday off): no visit, block or closed date.
const free = [];
for (let n = 10; free.length < 3; n++) {
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
const [D1, D2, D3] = free;

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
  await db`update businesses set start_zip = '94063', max_drive_minutes = 35 where id = ${biz}`;
  await visit(D1, "09:00", "11:00", "confirmed", "94063");
  await visit(D2, "11:00", "13:00", "cancelled", "94611");
  await visit(D3, "11:00", "13:00", "confirmed", "99999");

  // (a) Piedmont is ~61 min from both the Redwood City visit and the van's start.
  const piedmont = await timesFor({ ...PIEDMONT, phone: PHONES[0] }, [D1]);
  if (piedmont && piedmont[D1].length) fail(`94611 was offered ${D1} (${hhmm(piedmont[D1])}), which has a Redwood City visit`);
  step(`(a) 94611 client: nothing on ${D1} (Redwood City visit 9–11)`);

  // (a), (c), (d) for San Mateo, ~19 min from Redwood City.
  const sm = await timesFor({ ...SAN_MATEO, phone: PHONES[1] }, [D1, D2, D3]);
  if (!sm) fail("94402 should see open times");
  if (!sm[D1].length) fail(`94402 should see times on ${D1}`);
  step(`(a) 94402 client: ${D1} offers ${hhmm(sm[D1])}`);
  if (!sm[D2].includes(11 * 60)) fail(`a cancelled 94611 visit must not block 94402 on ${D2}, got ${hhmm(sm[D2])}`);
  step(`(c) cancelled 94611 visit on ${D2} doesn't count: 94402 is offered ${hhmm(sm[D2])}`);
  if (sm[D3].length) fail(`a visit at an unknown ZIP must block the times around it on ${D3}, got ${hhmm(sm[D3])}`);
  step(`(d) visit at unknown ZIP 99999 on ${D3}: no times for 94402`);

  // (a) with no start ZIP (Review Focus 1): only the Redwood City visit keeps Piedmont off D1.
  await db`update businesses set start_zip = null where id = ${biz}`;
  const noStart = await timesFor({ ...PIEDMONT, phone: PHONES[2] }, [D1, D2, D3]);
  if (!noStart) fail("with no start ZIP, 94611 should see some days");
  if (noStart[D1].length) fail(`94611 was offered ${D1} (${hhmm(noStart[D1])}) with no start ZIP`);
  if (!noStart[D2].length) fail(`with no start ZIP, 94611 should see ${D2}`);
  if (noStart[D3].length) fail(`(d) the unknown ZIP must block 94611 too on ${D3}, got ${hhmm(noStart[D3])}`);
  step(`(a) no start ZIP: 94611 sees ${D2} (${hhmm(noStart[D2])}) but not ${D1}; (d) nor ${D3}`);
  await db`update businesses set start_zip = '94063' where id = ${biz}`;

  // (b) A Piedmont visit 14–16 the same day: San Mateo can't sit between Redwood City and Piedmont.
  await visit(D1, "14:00", "16:00", "confirmed", "94611");
  const between = await timesFor({ ...SAN_MATEO, phone: PHONES[3] }, [D1]);
  const d1 = between?.[D1] ?? [];
  if (d1.some((m) => m >= 11 * 60 && m < 14 * 60)) fail(`94402 was offered a time between 11:00 and 14:00 on ${D1}: ${hhmm(d1)}`);
  if (d1.some((m) => m >= 16 * 60)) fail(`94402 was offered a time after the Piedmont visit on ${D1}: ${hhmm(d1)}`);
  if (!d1.some((m) => m < 9 * 60)) fail(`94402 should still see the times before 9:00 on ${D1}, got ${hhmm(d1)}`);
  step(`(b) between Redwood City (9–11) and Piedmont (14–16): 94402 only gets ${hhmm(d1)}`);

  if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
} finally {
  await db`update businesses set start_zip = ${oldStartZip}, max_drive_minutes = ${oldLimit} where id = ${biz}`;
  await cleanUp();
  await browser.close();
  await db.end();
}
console.log("All good.");
