// One business can never see or touch another's data. Run after slice.mjs. Needs DATABASE_URL.
// A second business ("Other Spa") gets a client, a pet, a visit and a receipt → the first
// business's owner opens every screen and file with those ids: always "not found", never their
// names → searching doesn't find them → the database itself refuses any row that links one
// business's data to another's (visit → client, visit → pet, payment → receipt, etc.).
// Usage: node tests/e2e/tenant-isolation.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = postgres(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/woofers", { max: 1, onnotice: () => {} });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

// 1. A second business with its own data (the secret names must never show to the first).
const stamp = Date.now();
const other = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await other.goto(`${BASE}/signup`);
await other.getByLabel("Business name").fill("Other Spa");
await other.getByLabel("Your name").fill("Olga");
await other.getByLabel("Email").fill(`other${stamp}@example.com`);
await other.getByLabel("Password").fill("other other 123");
await other.getByRole("checkbox").check();
await other.getByRole("button", { name: "Create my account" }).click();
await other.waitForURL(/\/welcome/);
const [b] = await db`select b.id as business, s.id as staff from businesses b join staff s on s.business_id = b.id
                     join users u on u.id = s.user_id where u.email = ${`other${stamp}@example.com`}`;
const [client] = await db`insert into clients (business_id, first_name, last_name, phone) values (${b.business}, 'Zelda', 'Secretson', '+16505559911') returning id`;
const [pet] = await db`insert into pets (client_id, name) values (${client.id}, 'Shadowfax') returning id`;
const [visit] = await db`insert into appointments (business_id, client_id, staff_id, start_at, end_at, status)
                         values (${b.business}, ${client.id}, ${b.staff}, now() + interval '2 days', now() + interval '2 days 1 hour', 'confirmed') returning id`;
await db`insert into appointment_pets (appointment_id, pet_id) values (${visit.id}, ${pet.id})`;
const [bill] = await db`insert into invoices (business_id, client_id, appointment_id, receipt_no) values (${b.business}, ${client.id}, ${visit.id}, 1) returning id`;
step("a second business with its own client, pet, visit and receipt");

// 2. The first business's owner tries every screen and file with the other business's ids.
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
const paths = [
  `/clients/${client.id}`, `/clients/${client.id}/edit`, `/clients/${client.id}/pets/${pet.id}`,
  `/appointments/${visit.id}`, `/appointments/${visit.id}/checkout`, `/appointments/${visit.id}/repeat`,
  `/appointments/${visit.id}/services`, `/appointments/new?client=${client.id}`, `/settings/team/${b.staff}`,
  `/api/pets/${pet.id}/photo`, `/groomer-photo/${b.staff}`, `/today?groomer=${b.staff}`, `/calendar?groomer=${b.staff}`,
];
for (const path of paths) {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
  const body = res.status === 200 ? await res.text() : "";
  if (/Zelda|Secretson|Shadowfax|Olga/.test(body)) fail(`${path} shows the other business's data`);
}
await page.goto(`${BASE}/clients?q=Zelda`);
if (await page.getByText(/Zelda|Secretson/).count()) fail("searching shouldn't find the other business's client");
step(`${paths.length} screens and files with the other business's ids: nothing of theirs shows`);

// 3. The database refuses rows that link one business's data to another's.
const [mine] = await db`select a.id, a.business_id, a.client_id, a.staff_id from appointments a
                        join businesses bz on bz.id = a.business_id where bz.booking_slug = 'woofers' limit 1`;
const [myService] = await db`select id from services where business_id = ${mine.business_id} limit 1`;
const refused = async (label, run) => {
  try {
    await run();
  } catch (e) {
    if (e.code === "42501") return;
    fail(`${label}: wrong error ${e.code} ${e.message}`);
  }
  fail(`${label}: the database should refuse it`);
};
await refused("my visit for their client", () => db`insert into appointments (business_id, client_id, staff_id, start_at, end_at)
  values (${mine.business_id}, ${client.id}, ${mine.staff_id}, now() + interval '9 days', now() + interval '9 days 1 hour')`);
await refused("my visit moved to their groomer", () => db`update appointments set staff_id = ${b.staff} where id = ${mine.id}`);
await refused("their pet on my visit", () => db`insert into appointment_pets (appointment_id, pet_id) values (${mine.id}, ${pet.id})`);
await refused("my service on their visit", async () => {
  const [ap] = await db`select id from appointment_pets where appointment_id = ${visit.id}`;
  await db`insert into appointment_services (appointment_pet_id, service_id, name, price_cents, duration_min) values (${ap.id}, ${myService.id}, 'x', 1, 1)`;
});
await refused("a receipt of mine for their visit", () => db`insert into invoices (business_id, client_id, appointment_id, receipt_no)
  values (${mine.business_id}, ${mine.client_id}, ${visit.id}, 999)`);
await refused("a payment by my groomer on their receipt", () => db`insert into payments (invoice_id, staff_id, amount_cents, method) values (${bill.id}, ${mine.staff_id}, 100, 'cash')`);
await refused("a note by my groomer on their client", () => db`insert into client_notes (client_id, staff_id, body) values (${client.id}, ${mine.staff_id}, 'x')`);
// Their own links still work.
await db`insert into client_notes (client_id, staff_id, body) values (${client.id}, ${b.staff}, 'ok')`;
step("the database refuses any row linking two businesses' data (and allows a business's own)");

await db.end();
await browser.close();
console.log("tenant-isolation: all good");
