// Pets on a visit, end to end. Run after slice.mjs (Maria Lopez, Biscuit), with DATABASE_URL.
// Maria gets a second pet, Lola, and three upcoming visits: A (Biscuit + Lola), B (only Lola),
// C (Biscuit + Lola).
//   · On visit A, tapping Lola opens her profile; "Remove Lola from this visit" takes her off (the
//     visit gets shorter); with one pet left there's nothing to remove.
//   · Lola passed away: she comes off C (it has Biscuit); B has only Lola, so it's listed with
//     "Cancel these visits", which cancels it.
// This test's rows are removed at the end.
// Usage: node tests/e2e/visit-pets.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const db = postgres(process.env.DATABASE_URL);
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const TZ = "America/Los_Angeles";
const la = (k) => new Date(Date.now() + k * 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });
const at = (date, time) => db`select (${date}::date + ${time}::time) at time zone ${TZ} as t`.then(([r]) => r.t);
const [{ client, biz, owner, biscuit }] = await db`
  select c.id as client, c.business_id as biz, s.id as owner, p.id as biscuit from clients c
  join staff s on s.business_id = c.business_id and s.role = 'owner' join pets p on p.client_id = c.id and p.name = 'Biscuit'
  where c.first_name = 'Maria' limit 1`;
const [{ id: service }] = await db`select id from services where business_id = ${biz} and kind = 'service' limit 1`;

const made = [];
const cleanUp = async () => {
  await db`delete from appointments where id = any(${made})`;
  await db`delete from pets where client_id = ${client} and name = 'Lola'`;
};
await db`delete from pets where client_id = ${client} and name = 'Lola'`;
const [{ id: lola }] = await db`insert into pets (client_id, name, breed, size_class) values (${client}, 'Lola', 'Beagle', 'small') returning id`;
const visit = async (days, time, pets) => {
  const start = await at(la(days), time);
  const [a] = await db`insert into appointments (business_id, client_id, staff_id, start_at, end_at, status, zip)
    values (${biz}, ${client}, ${owner}, ${start}, ${new Date(start.getTime() + pets.length * 60 * 60_000)}, 'confirmed', '94063') returning id`;
  made.push(a.id);
  for (const p of pets) {
    const [ap] = await db`insert into appointment_pets (appointment_id, pet_id) values (${a.id}, ${p}) returning id`;
    await db`insert into appointment_services (appointment_pet_id, service_id, name, price_cents, duration_min) values (${ap.id}, ${service}, 'Bath', 9900, 60)`;
  }
  return a.id;
};
const A = await visit(20, "09:00", [biscuit, lola]);
const B = await visit(21, "09:00", [lola]);
const C = await visit(22, "09:00", [biscuit, lola]);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errors = [];
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on("pageerror", (e) => errors.push(e.message));
const shot = (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const petsOn = async (id) => (await db`select p.name from appointment_pets ap join pets p on p.id = ap.pet_id where ap.appointment_id = ${id} order by p.name`).map((r) => r.name).join(",");
try {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', "owner@example.com");
  await page.fill('input[name="password"]', "correct horse battery");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/today/);

  // Tapping a pet on the visit opens the pet's profile.
  await page.goto(`${BASE}/appointments/${A}`);
  await page.getByRole("link", { name: /^Lola/ }).first().click();
  await page.waitForURL(new RegExp(`/clients/${client}/pets/${lola}`));
  step("tapping Lola on the visit opens her profile");

  // Remove Lola from visit A.
  await page.goto(`${BASE}/appointments/${A}`);
  await page.getByRole("button", { name: "Remove Lola from this visit" }).waitFor();
  await shot("VP01-visit-two-pets");
  await page.getByRole("button", { name: "Remove Lola from this visit" }).click();
  await page.getByRole("button", { name: "Yes, remove Lola" }).click();
  await page.getByRole("link", { name: /^Lola/ }).waitFor({ state: "detached" });
  if ((await petsOn(A)) !== "Biscuit") fail(`visit A should have only Biscuit: ${await petsOn(A)}`);
  const [{ mins }] = await db`select extract(epoch from end_at - start_at)::int / 60 as mins from appointments where id = ${A}`;
  if (mins !== 60) fail(`visit A should get shorter (60 min), is ${mins}`);
  if (await page.getByRole("button", { name: /Remove Biscuit from this visit/ }).count()) fail("with one pet left there's nothing to remove");
  step("Remove Lola from this visit: only Biscuit stays, the visit gets shorter, and the last pet can't be removed");

  // Lola passed away.
  await page.goto(`${BASE}/clients/${client}/pets/${lola}`);
  await page.getByRole("button", { name: "Lola passed away 🌈" }).click();
  await page.getByText(/Lola was taken off 1 upcoming visit/).waitFor();
  if ((await petsOn(C)) !== "Biscuit") fail(`Lola should come off visit C: ${await petsOn(C)}`);
  const only = page.getByRole("region", { name: /only Lola/ });
  await only.waitFor();
  if ((await only.getByRole("link").count()) !== 1) fail("visit B (only Lola) should be listed");
  await shot("VP02-passed-away");
  step("Lola passed away: she comes off the visit with Biscuit; the visit with only Lola is listed");
  await only.getByRole("button", { name: "Cancel these visits" }).click();
  await only.waitFor({ state: "detached" });
  const [{ status }] = await db`select status from appointments where id = ${B}`;
  if (status !== "cancelled") fail(`visit B should be cancelled, is ${status}`);
  step("Cancel these visits cancels the visit that had only Lola");

  if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
  console.log("visit-pets: all good");
} finally {
  await browser.close();
  await cleanUp();
  await db.end();
}
