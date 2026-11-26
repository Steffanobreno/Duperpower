// Reports count money on the day of the visit, end to end. Run after slice.mjs, with DATABASE_URL.
// Owners close older visits later (Pending): a visit 10 days ago paid today must show on that day,
// not today. A visit 10 days ago (Rita, $120 + $10 tip, paid today in Venmo) and one today (Tom, $50,
// paid today in cash). Report for the day 10 days ago: collected $130, Rita in the top clients,
// Venmo $120; for today: Tom's $50 only, Rita not there. The PDF/CSV export (CSV) follows the
// same rule. This test's rows are removed at the end.
// Usage: node tests/e2e/reports-by-visit.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = postgres(process.env.DATABASE_URL);
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const TZ = "America/Los_Angeles";
const la = (k) => new Date(Date.now() + k * 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });
const at = (date, time) => db`select (${date}::date + ${time}::time) at time zone ${TZ} as t`.then(([r]) => r.t);
const [{ biz, owner }] = await db`select b.id as biz, s.id as owner from businesses b join staff s on s.business_id = b.id
                                  where b.booking_slug = 'woofers' and s.role = 'owner' limit 1`;
const cleanUp = async () => {
  const ids = (await db`select id from clients where business_id = ${biz} and last_name = 'Reportday'`).map((r) => r.id);
  await db`delete from payments where invoice_id in (select id from invoices where client_id = any(${ids}))`;
  await db`delete from invoices where client_id = any(${ids})`;
  await db`delete from appointments where client_id = any(${ids})`;
  await db`delete from clients where id = any(${ids})`;
};
await cleanUp();

const PAST = la(-10);
const TODAY = la(0);
const paidVisit = async (first, date, cents, tip, method) => {
  const [c] = await db`insert into clients (business_id, first_name, last_name, phone) values (${biz}, ${first}, 'Reportday', ${`+1650555${Math.floor(1000 + Math.random() * 8999)}`}) returning id`;
  const [a] = await db`insert into appointments (business_id, client_id, staff_id, start_at, end_at, status)
    values (${biz}, ${c.id}, ${owner}, ${await at(date, "10:00")}, ${await at(date, "11:00")}, 'completed') returning id`;
  const [i] = await db`insert into invoices (business_id, appointment_id, client_id, status, total_cents, paid_cents, tip_cents, closed_at)
    values (${biz}, ${a.id}, ${c.id}, 'closed', ${cents + tip}, ${cents + tip}, ${tip}, now()) returning id`;
  // Paid now (today), whatever the visit's day.
  await db`insert into payments (invoice_id, method, amount_cents, tip_cents, staff_id, received_at)
    values (${i.id}, ${method}, ${cents}, ${tip}, ${owner}, now())`;
};
await paidVisit("Rita", PAST, 12000, 1000, "venmo");
await paidVisit("Tom", TODAY, 5000, 0, "cash");

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const day = async (d) => {
  await page.goto(`${BASE}/reports?from=${d}&to=${d}`);
  await page.getByText("Top clients by spending").or(page.getByText("Collected").first()).first().waitFor();
  return (await page.locator("main, body").first().innerText()).replace(/\s+/g, " ");
};
try {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', "owner@example.com");
  await page.fill('input[name="password"]', "correct horse battery");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/today/);

  const past = await day(PAST);
  if (!/Rita Reportday/.test(past)) fail(`the day of Rita's visit should list her in the top clients`);
  if (!/incl\. \$10\.00 tips/.test(past) || !/\$130\.00/.test(past)) fail(`the day of Rita's visit should show $130 collected incl. $10 tips`);
  step("the day of the visit shows its payment ($130 incl. $10 tip) and the client, though it was paid today");

  const today = await day(TODAY);
  if (/Rita Reportday/.test(today)) fail("today should not list Rita (her visit was 10 days ago)");
  if (!/Tom Reportday/.test(today)) fail("today should list Tom");
  step("today shows only today's visits' payments (Tom), not Rita's");

  // The export uses the same rule.
  const csv = await page.evaluate(async (u) => (await fetch(u)).text(), `${BASE}/reports/export?from=${PAST}&to=${PAST}&format=csv`).catch(() => "");
  if (!/Rita Reportday/.test(csv)) fail("the CSV for the day of Rita's visit should have her payment");
  step("the CSV export follows the same rule");

  if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
  console.log("reports-by-visit: all good");
} finally {
  await browser.close();
  await cleanUp();
  await db.end();
}
