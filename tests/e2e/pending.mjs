// Pending: visits to close and to collect, by day, week or month. Run after slice.mjs, with DATABASE_URL.
// Counting starts on the day of the first payment closed in the app (here a payment 60 days ago).
// On a past day D (two weeks ago):
//   09:00 confirmed → "To close" · 13:00 completed, no payment → "To collect" · completed and paid
//   the next day → nowhere. A confirmed visit 30 days ago → "more before this"; one 90 days ago,
//   before counting starts → nowhere.
// Week, Day and Month views of D show the two; the arrows move the period. "Mark done" opens checkout
// and the visit moves to "To collect". The side menu and Today show how many are pending.
// This test's rows are removed at the end.
// Usage: node tests/e2e/pending.mjs [baseUrl]
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
  const ids = (await db`select id from clients where business_id = ${biz} and last_name = 'Pendingtest'`).map((r) => r.id);
  const appts = (await db`select id from appointments where client_id = any(${ids})`).map((r) => r.id);
  await db`delete from payments where invoice_id in (select id from invoices where client_id = any(${ids}))`;
  await db`delete from invoice_items where invoice_id in (select id from invoices where client_id = any(${ids}))`;
  await db`delete from invoices where client_id = any(${ids})`;
  await db`delete from appointment_services where appointment_pet_id in (select id from appointment_pets where appointment_id = any(${appts}))`;
  await db`delete from appointment_pets where appointment_id = any(${appts})`;
  await db`delete from appointments where id = any(${appts})`;
  await db`delete from pets where client_id = any(${ids})`;
  await db`delete from clients where id = any(${ids})`;
};
await cleanUp();

const D = la(-14);
const [{ id: client }] = await db`insert into clients (business_id, first_name, last_name, phone, zip)
  values (${biz}, 'Penny', 'Pendingtest', '+16505550191', '94063') returning id`;
const [{ id: service }] = await db`select id from services where business_id = ${biz} and kind = 'service' limit 1`;
const [{ id: pet }] = await db`insert into pets (client_id, name, size_class) values (${client}, 'Pepper', 'small') returning id`;
const visit = async (date, from, to, status) => {
  const [a] = await db`insert into appointments (business_id, client_id, staff_id, start_at, end_at, status, zip)
    values (${biz}, ${client}, ${owner}, ${await at(date, from)}, ${await at(date, to)}, ${status}, '94063') returning id`;
  const [ap] = await db`insert into appointment_pets (appointment_id, pet_id) values (${a.id}, ${pet}) returning id`;
  await db`insert into appointment_services (appointment_pet_id, service_id, name, price_cents, duration_min) values (${ap.id}, ${service}, 'Bath', 9900, 120)`;
  return a.id;
};
// The first payment closed in the app: 60 days ago (counting starts that day).
await db`insert into invoices (business_id, client_id, status, total_cents, paid_cents, closed_at)
         values (${biz}, ${client}, 'closed', 100, 100, now() - interval '60 days')`;
const toClose = await visit(D, "09:00", "11:00", "confirmed");
await visit(D, "13:00", "15:00", "completed");
const paid = await visit(la(-13), "09:00", "11:00", "completed");
await db`insert into invoices (business_id, appointment_id, client_id, status, total_cents, paid_cents, closed_at)
         values (${biz}, ${paid}, ${client}, 'closed', 9900, 9900, now() - interval '13 days')`;
await visit(la(-30), "09:00", "11:00", "confirmed");
await visit(la(-90), "09:00", "11:00", "confirmed");

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errors = [];
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on("pageerror", (e) => errors.push(e.message));
const section = (name) => page.getByRole("region", { name: new RegExp(`^${name}`) });
const pennyIn = (name) => section(name).getByRole("link", { name: /Penny/ });
// Opens a period and waits for it to finish loading (the app shows a skeleton first).
const open = async (view, date) => {
  await page.goto(`${BASE}/pending?view=${view}&date=${date}`);
  await page.getByRole("heading", { name: "Pending" }).or(page.getByText("All closed")).first().waitFor();
  await section("To close").or(page.getByText("All closed")).first().waitFor();
};
try {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', "owner@example.com");
  await page.fill('input[name="password"]', "correct horse battery");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/today/);

  // Today and the side menu show how many are pending.
  await page.getByRole("link", { name: /visits? to close or collect/ }).waitFor();
  await page.getByRole("button", { name: /menu/i }).first().click();
  const menuItem = page.getByRole("link", { name: /^Pending/ });
  if (!/\d/.test(await menuItem.innerText())) fail("the side menu should show how many are pending");
  step("Today and the side menu show how many visits are pending");

  // Week of D: one to close, one to collect; the paid one and the one before counting starts are not there.
  await open("week", D);
  if ((await pennyIn("To close").count()) !== 1) fail("one of Penny's visits should be to close that week");
  if ((await pennyIn("To collect").count()) !== 1) fail("one of Penny's visits should be to collect that week");
  if (!/\$99/.test(await section("To close").innerText())) fail("the visit's price should show");
  step("Week: the visit not marked done is to close, the one without payment is to collect, the paid one isn't there");
  await page.getByText(/more before this/).waitFor();
  step("older pending visits are pointed to (\"more before this\")");

  // Day and Month of D show the same two; the arrows move the period.
  await open("day", D);
  if ((await pennyIn("To close").count()) !== 1 || (await pennyIn("To collect").count()) !== 1) fail("the day view should show both");
  await page.getByRole("link", { name: "Next" }).click();
  await page.waitForURL(new RegExp(`date=${la(-13)}`));
  await section("To close").or(page.getByText("All closed")).first().waitFor();
  if ((await page.getByRole("link", { name: /Penny/ }).count()) !== 0) fail("the next day has only the paid visit: nothing pending");
  await open("month", D);
  if ((await pennyIn("To close").count()) < 1 || (await pennyIn("To collect").count()) < 1) fail("the month view should show both");
  const all = await page.getByRole("link", { name: /Penny/ }).count();
  const thirty = la(-30).slice(0, 7) === D.slice(0, 7);
  if (all !== (thirty ? 3 : 2)) fail(`the month should hold ${thirty ? 3 : 2} of Penny's pending visits, shows ${all}`);
  step("Day and Month show the same visits; the arrows move the period");

  // Before counting starts (90 days ago): nothing.
  await open("day", la(-90));
  if ((await page.getByRole("link", { name: /Penny/ }).count()) !== 0) fail("a visit before the first payment in the app shouldn't count");
  step("visits before the first payment closed in the app don't count");

  // Mark done → checkout; back on Pending it's to collect.
  await open("day", D);
  await section("To close").getByRole("button", { name: "Mark done" }).click();
  await page.waitForURL(new RegExp(`/appointments/${toClose}/checkout`));
  await open("day", D);
  await pennyIn("To collect").nth(1).waitFor();
  if ((await pennyIn("To close").count()) !== 0 || (await pennyIn("To collect").count()) !== 2) fail("after Mark done the visit should be to collect");
  step("Mark done opens checkout, and the visit moves to To collect");

  if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
  console.log("pending: all good");
} finally {
  await browser.close();
  await cleanUp();
  await db.end();
}
