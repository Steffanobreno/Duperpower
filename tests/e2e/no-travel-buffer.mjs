// No driving time is added around visits on the booking page. Run after slice.mjs, with DATABASE_URL.
// Owners reported: visits last 2–3 hours, and 45 min of driving kept free before and after each
// visit meant a 2-hour gap between two visits needed 2h45 and was never offered. Now a gap exactly
// as long as the service is offered, even if an old business still has driving minutes stored.
//   (a) A free day with visits 09:00–11:00 and 13:00–15:00 (same ZIP as the client, so the drive
//       limit allows it) and 45 driving minutes stored: a 2-hour bath gets 11:00, and 07:00 (ends at 9:00).
//   (b) Settings → Online booking no longer has "Driving time between visits".
// The stored minutes are restored at the end, and this test's rows removed.
// Usage: node tests/e2e/no-travel-buffer.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = postgres(process.env.DATABASE_URL);
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

const [{ biz, owner, buffer_minutes: oldBuffer }] = await db`
  select b.id as biz, s.id as owner, b.buffer_minutes from businesses b join staff s on s.business_id = b.id
  where b.booking_slug = 'woofers' and s.role = 'owner' limit 1`;
const TZ = "America/Los_Angeles";
const la = (k) => new Date(Date.now() + k * 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });
const weekday = (d) => new Date(`${d}T12:00:00Z`).getUTCDay();
const at = (date, time) => db`select (${date}::date + ${time}::time) at time zone ${TZ} as t`.then(([r]) => r.t);
const PHONE = "6505550181";

const cleanUp = async () => {
  const ids = (await db`select id from clients where business_id = ${biz} and last_name in ('Nobuffer', 'Gap')`).map((r) => r.id);
  await db`delete from appointments where client_id = any(${ids})`;
  await db`delete from pets where client_id = any(${ids})`;
  await db`delete from clients where id = any(${ids})`;
  await db`delete from booking_drafts where business_id = ${biz} and right(phone, 10) = ${PHONE}`;
  await db`update businesses set buffer_minutes = ${oldBuffer} where id = ${biz}`;
};
await cleanUp();

// A free working day 10+ days ahead (seed hours: Sunday off) with hours from 7:00 or earlier.
let D;
for (let n = 10; !D; n++) {
  const d = la(n);
  if (weekday(d) === 0) continue;
  const { start, end } = { start: await at(d, "00:00"), end: await at(d, "23:59") };
  const [{ busy }] = await db`select
      exists (select 1 from appointments where staff_id = ${owner} and start_at < ${end} and end_at > ${start}
              and status not in ('cancelled', 'no_show', 'declined'))
   or exists (select 1 from time_off where staff_id = ${owner} and start_at < ${end} and end_at > ${start})
   or exists (select 1 from closed_dates where business_id = ${biz} and ${d}::date between start_date and end_date) as busy`;
  if (!busy) D = d;
}

await db`update businesses set buffer_minutes = 45 where id = ${biz}`;
const [{ id: stopClient }] = await db`insert into clients (business_id, first_name, last_name, phone, zip)
  values (${biz}, 'Stop', 'Nobuffer', '+16505550182', '94063') returning id`;
for (const [from, to] of [["09:00", "11:00"], ["13:00", "15:00"]]) {
  await db`insert into appointments (business_id, client_id, staff_id, start_at, end_at, status, zip)
    values (${biz}, ${stopClient}, ${owner}, ${await at(D, from)}, ${await at(D, to)}, 'confirmed', '94063')`;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on("pageerror", (e) => errors.push(e.message));
const button = (name) => page.getByRole("button", { name, exact: true });

try {
  // (a) A new client at 94063 walks to "Select a time" for a 2-hour bath.
  await page.goto(`${BASE}/book`);
  await page.getByLabel("Mobile phone").fill(PHONE);
  await button("Next").click();
  await page.getByText("It looks like your first visit with us.").waitFor();
  await page.getByLabel("First name").fill("Gina");
  await page.getByLabel("Last name").fill("Gap");
  await page.getByLabel("Email").fill("gina@example.com");
  await button("Continue").click();
  await page.getByLabel("Street address").fill("1 Oak St");
  await page.getByLabel("City").fill("Redwood City");
  await page.getByLabel("ZIP code").fill("94063");
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
  await page.getByRole("heading", { name: "Select a time" }).waitFor();

  const month = new Date(`${D}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const want = D.slice(0, 7);
  for (let i = 0; i < 13 && (await page.getByRole("heading", { name: month, exact: true }).count()) === 0; i++) {
    const shown = await page.getByRole("heading", { name: /^[A-Z][a-z]+ \d{4}$/ }).first().textContent();
    const [name, year] = shown.trim().split(" ");
    const m = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(name) + 1;
    await button(`${year}-${String(m).padStart(2, "0")}` < want ? "Next month" : "Previous month").click();
  }
  const label = new Date(`${D}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const cell = page.locator(`button[aria-label^="${label}, "]`);
  if (await cell.isDisabled()) fail(`${D} has no open time at all`);
  await cell.click();
  const texts = await page.getByRole("group", { name: "Open times" }).locator("button").allInnerTexts();
  const mins = texts.map((t) => {
    const [, h, m, ap] = t.match(/(\d+):(\d+)\s*([AP]M)/i);
    return ((Number(h) % 12) + (/p/i.test(ap) ? 12 : 0)) * 60 + Number(m);
  });
  const hhmm = (x) => `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`;
  if (!mins.includes(11 * 60)) fail(`the 2-hour gap 11:00–13:00 is not offered; times: ${mins.map(hhmm).join(", ")}`);
  if (!mins.includes(7 * 60)) fail(`7:00 (ends at 9:00, when the next visit starts) is not offered; times: ${mins.map(hhmm).join(", ")}`);
  step(`a 2-hour bath fits a 2-hour gap: ${mins.map(hhmm).join(", ")} on ${D}`);

  // (b) The setting is gone from Settings → Online booking.
  const owner = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  owner.on("pageerror", (e) => errors.push(e.message));
  await owner.goto(`${BASE}/login`);
  await owner.fill('input[name="email"]', "owner@example.com");
  await owner.fill('input[name="password"]', "correct horse battery");
  await owner.click('button[type="submit"]');
  await owner.waitForURL((u) => !u.pathname.startsWith("/login"));
  await owner.goto(`${BASE}/settings/booking`);
  await owner.getByText("Maximum drive minutes between clients").waitFor();
  if (await owner.getByText("Driving time between visits").count()) fail("Settings still shows Driving time between visits");
  step("Settings → Online booking has no driving time between visits");

  if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
  console.log("All good.");
} finally {
  await browser.close();
  await cleanUp();
  await db.end();
}
