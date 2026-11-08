// The KPI panel, end to end. Run with DATABASE_URL. Signs up its own business (America/Los_Angeles)
// and seeds by SQL: two finished visits today paid $100 and $50, one finished visit paid $70 on
// the last day of last month at 23:30 Los Angeles time (already the 1st in UTC: not this month),
// and one no-show today.
// /reports shows Revenue $150.00 ("new": nothing last month), Average ticket $75.00 and
// No-shows and cancellations 1. Today (map mode) shows the 3 tiles with the visit cards still
// above the tab bar. A groomer (no "reports") sees no tiles on Today and is sent away from /reports.
// Usage: node tests/e2e/kpis.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";
import { randomBytes, scryptSync } from "node:crypto";

const BASE = process.argv[2] ?? "http://localhost:3000";
const TZ = "America/Los_Angeles";
const db = postgres(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/woofers", { max: 1 });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const newPage = async () => {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: TZ })).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
};
const login = async (page, email, password) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/today|\/welcome/);
};

// 1. A new business, set up (so Today shows no "Get started" card), in Los Angeles time.
const stamp = Date.now();
const OWNER_EMAIL = `kpis-${stamp}@example.com`;
const OWNER_PASSWORD = "sudsy sudsy 123";
const owner = await newPage();
await owner.goto(`${BASE}/signup`);
await owner.getByLabel("Business name").fill(`KPI Grooming ${stamp}`);
await owner.getByLabel("Your name").fill("Kay");
await owner.getByLabel("Email").fill(OWNER_EMAIL);
await owner.getByLabel("Password").fill(OWNER_PASSWORD);
await owner.getByRole("checkbox").check();
await owner.getByRole("button", { name: "Create my account" }).click();
await owner.waitForURL(/\/welcome/);
const [{ biz, staff }] = await db`
  select b.id as biz, s.id as staff from businesses b join staff s on s.business_id = b.id join users u on u.id = s.user_id
  where u.email = ${OWNER_EMAIL}`;
await db`update businesses set timezone = ${TZ}, onboarded_at = now() where id = ${biz}`;
step("signed up a new business in Los Angeles time");

// 2. The visits and payments.
const [{ today, lastPrev }] = await db`
  select to_char((now() at time zone ${TZ})::date, 'YYYY-MM-DD') as today,
         to_char(date_trunc('month', (now() at time zone ${TZ})::date) - interval '1 day', 'YYYY-MM-DD') as "lastPrev"`;
const at = (day, time) => db`select (${day}::date + ${time}::time) at time zone ${TZ} as t`.then(([r]) => r.t);
const [{ id: client }] = await db`insert into clients (business_id, first_name, last_name, phone)
  values (${biz}, 'Kim', 'Kpi', '+16505550199') returning id`;
const visit = async (day, from, to, status) => {
  const [{ id }] = await db`insert into appointments (business_id, client_id, staff_id, start_at, end_at, status)
    values (${biz}, ${client}, ${staff}, ${await at(day, from)}, ${await at(day, to)}, ${status}) returning id`;
  return id;
};
const paid = async (appointment, cents, receivedAt) => {
  const [{ id }] = await db`insert into invoices (business_id, appointment_id, client_id, status, subtotal_cents, total_cents, paid_cents, closed_at)
    values (${biz}, ${appointment}, ${client}, 'closed', ${cents}, ${cents}, ${cents}, ${receivedAt}) returning id`;
  await db`insert into payments (invoice_id, method, amount_cents, received_at, staff_id) values (${id}, 'cash', ${cents}, ${receivedAt}, ${staff})`;
};
const now = new Date();
await paid(await visit(today, "08:00", "09:00", "completed"), 10000, now);
await paid(await visit(today, "09:30", "10:30", "completed"), 5000, now);
await paid(await visit(lastPrev, "22:30", "23:30", "completed"), 7000, await at(lastPrev, "23:30"));
await visit(today, "11:00", "12:00", "no_show");
step("seeded 2 paid visits today, 1 paid on the last day of last month at 23:30, 1 no-show today");

// 3. Reports: the month-to-date tiles, read by their names.
// Signed in by the signup.
await owner.goto(`${BASE}/reports`);
const tile = (name) => owner.locator(`[role="group"][aria-label="${name}"]`);
await tile("Revenue").waitFor();
const text = async (name) => (await tile(name).innerText()).replace(/\s+/g, " ");
const revenue = await text("Revenue");
if (!revenue.includes("$150.00")) fail(`Revenue should be $150.00 (not the payment from last month), got "${revenue}"`);
const isLastDay = (await db`select (${today}::date + 1)::text like '%-01' as last`)[0].last;
if (!isLastDay && !/\bnew\b/.test(revenue)) fail(`Revenue should say "new" (nothing in last month's window), got "${revenue}"`);
const avg = await text("Average ticket");
if (!avg.includes("$75.00")) fail(`Average ticket should be $75.00, got "${avg}"`);
const noShows = await text("No-shows and cancellations");
if (!/\b1\b/.test(noShows.replace("No-shows and cancellations", ""))) fail(`No-shows and cancellations should be 1, got "${noShows}"`);
const overdue = tile("Overdue clients").getByRole("link");
if (!(await overdue.getAttribute("href")).endsWith(`/fill/${today}`)) fail("the Overdue clients tile should link to /fill/<today>");
step("Reports: Revenue $150.00 (new), Average ticket $75.00, No-shows and cancellations 1, Overdue links to Fill");

// 4. Today (map mode with stops): the 3 tiles, and the visit cards stay above the tab bar.
await owner.goto(`${BASE}/today`);
await owner.getByRole("img", { name: "Map of the day's visits" }).waitFor();
for (const name of ["Revenue", "Occupancy this week", "Overdue clients"]) {
  if (!(await tile(name).count())) fail(`Today should show the "${name}" tile`);
}
if (await tile("Average ticket").count()) fail("Today shows only 3 tiles");
if (!(await owner.locator('[aria-label="Visits"]').count())) fail("the day's visit cards should show in map mode");
const gap = await owner.evaluate(() =>
  document.querySelector('nav[aria-label="Main"]').getBoundingClientRect().top - document.querySelector('[aria-label="Visits"]').getBoundingClientRect().bottom);
if (gap < 0) fail(`the cards are ${-gap}px under the tab bar`);
step("Today (map): Revenue, Occupancy this week and Overdue clients, with the visit cards above the tab bar");
await owner.goto(`${BASE}/today?view=list`);
await tile("Revenue").waitFor();
if (!(await text("Revenue")).includes("$150.00")) fail("Today's Revenue tile should be $150.00");
step("Today (list): the tiles too, Revenue $150.00");

// 5. A groomer (no "reports"): no tiles on Today, and Reports sends them back.
const GROOMER_EMAIL = `kpis-groomer-${stamp}@example.com`;
const GROOMER_PASSWORD = "kpis-groomer-pw";
const salt = randomBytes(16);
// The same format as hashPassword in src/lib/auth.ts (which can't be imported outside Next).
const hash = `scrypt$${salt.toString("base64")}$${scryptSync(GROOMER_PASSWORD, salt, 64).toString("base64")}`;
const [{ id: user }] = await db`insert into users (email, password_hash) values (${GROOMER_EMAIL}, ${hash}) returning id`;
await db`insert into staff (business_id, name, role, user_id) values (${biz}, 'Kpi Groomer', 'groomer', ${user})`;
const groomer = await newPage();
await login(groomer, GROOMER_EMAIL, GROOMER_PASSWORD);
await groomer.goto(`${BASE}/today`);
await groomer.getByRole("heading", { name: "Today" }).waitFor();
if (await groomer.locator('[role="group"][aria-label="Revenue"]').count()) fail("a groomer without Reports should see no Revenue tile");
await groomer.goto(`${BASE}/reports`);
await groomer.waitForURL(/\/today\?denied=1/);
step("a groomer sees no tiles on Today and /reports sends them to /today?denied=1");

await db.end();
await browser.close();
if (errors.length) {
  console.error(errors);
  process.exit(1);
}
