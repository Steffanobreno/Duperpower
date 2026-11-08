// The pet owner's report card at /g/<token>, logged out. Run after grooms.mjs (Biscuit's cut has a
// photo and the tags calm and nails_done), with DATABASE_URL.
// Usage: node tests/e2e/report-card.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = postgres(process.env.DATABASE_URL);
const [{ first, pet }] = await db`
  select a.id as first, ap.pet_id as pet from appointments a
  join appointment_pets ap on ap.appointment_id = a.id order by a.created_at limit 1`;
const fail = (msg) => {
  throw new Error(msg);
};
const step = (msg) => console.log(`✓ ${msg}`);

await db`update pets set rebook_every_days = 42 where id = ${pet}`;
const [{ report_token: token, next }] = await db`
  update appointments a set report_token = md5(random()::text) where id = ${first}
  returning report_token,
    to_char((a.start_at at time zone (select timezone from businesses where id = a.business_id))::date + 42, 'YYYY-MM-DD') as next`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(`${BASE}/g/${token}`);
await page.getByRole("heading", { name: "Grooming report" }).waitFor();
const img = page.getByRole("img", { name: "Biscuit after the groom" });
await img.waitFor();
if (!(await img.evaluate((el) => el.complete && el.naturalWidth > 0))) fail("the photo should load");
for (const n of ["Calm", "Nails done"]) await page.getByText(n, { exact: true }).waitFor();
step("heading, photo and tags");

const href = await page.getByRole("link", { name: "Book the next one" }).getAttribute("href");
if (!href.includes(`date=${next}`)) fail(`the book link should carry date=${next}: ${href}`);
step("book link carries the next date");

if ((await page.goto(`${BASE}/g/${"0".repeat(32)}`)).status() !== 404) fail("an unknown token should be 404");
const uuid = "00000000-0000-4000-8000-000000000000";
const res = await page.request.get(`${BASE}/g/${token}/photo/${uuid}`);
if (res.status() !== 404) fail(`a foreign groom photo should be 404, got ${res.status()}`);
step("404s");

// ---- Part 2: sending it (owner side) ----
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

await db`delete from messages where appointment_id = ${first} and template_trigger = 'report_card'`;
await db`update appointments set report_sent_at = null where id = ${first}`;
await page.goto(`${BASE}/appointments/${first}`);
const card = page.getByRole("region", { name: "Report card" });
await card.waitFor();
const wa = await card.getByRole("link", { name: "WhatsApp" }).getAttribute("href");
if (!wa.includes(`%2Fg%2F${token}`)) fail(`the WhatsApp link should carry the report link: ${wa}`);
const preview = await card.getByRole("link", { name: "Preview" }).getAttribute("href");
if (preview !== `/g/${token}`) fail(`the preview link should open the report: ${preview}`);
step("card with WhatsApp link and preview");

await card.getByRole("button", { name: "Send by email" }).click();
await card.getByText(/^Sent \w/).waitFor();
const sent = await db`select 1 from messages where appointment_id = ${first} and template_trigger = 'report_card' and channel = 'email'`;
if (sent.length !== 1) fail(`one report card email row expected, got ${sent.length}`);
const [{ at }] = await db`select report_sent_at as at from appointments where id = ${first}`;
if (!at) fail("report_sent_at should be set");
step("manual email queued once, sent time recorded");

// Auto path: a second finished visit with a note, and a third with nothing to show.
const [src] = await db`select * from appointments where id = ${first}`;
const visit = async (hoursAgo, note) => {
  const [a] = await db`
    insert into appointments (business_id, client_id, staff_id, start_at, end_at, status)
    values (${src.business_id}, ${src.client_id}, ${src.staff_id}, now() - make_interval(hours => ${hoursAgo + 2}),
            now() - make_interval(hours => ${hoursAgo + 1}), 'completed') returning id`;
  const [ap] = await db`insert into appointment_pets (appointment_id, pet_id) values (${a.id}, ${pet}) returning id`;
  if (note) await db`insert into pet_grooms (appointment_pet_id, pet_id, note) values (${ap.id}, ${pet}, ${note})`;
  await db`insert into invoices (business_id, appointment_id, client_id, status, closed_at)
           values (${src.business_id}, ${a.id}, ${src.client_id}, 'closed', now() - make_interval(hours => ${hoursAgo}))`;
  return a.id;
};
const withNote = await visit(5, "Calm the whole time");
const empty = await visit(7, null);
await db`update message_templates set enabled = true where trigger = 'report_card'`;
const cron = async () => {
  const r = await page.request.get(`${BASE}/api/cron/messages`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? "test-cron-secret"}` } });
  if (r.status() !== 200) fail(`cron should answer 200, got ${r.status()}`);
};
await cron();
await cron();
const auto = await db`select dedupe_key from messages where dedupe_key like ${`report:${withNote}%`}`;
if (auto.length !== 1 || !auto[0].dedupe_key.startsWith(`report:${withNote}`)) fail(`exactly one auto row expected, got ${JSON.stringify(auto)}`);
const none = await db`select 1 from messages where appointment_id = ${empty} and template_trigger = 'report_card'`;
if (none.length) fail("a visit with nothing to show should get no report card");
step("auto email once for the visit with a note, none for the empty one");

await page.goto(`${BASE}/appointments/${empty}`);
await page.getByRole("region", { name: "Report card" }).getByText("Add a photo, note or tag first.").waitFor();
step("empty visit explains what is missing");

await db`update message_templates set enabled = false where trigger = 'report_card'`;
await db`delete from messages where appointment_id = any(${[withNote, empty]})`;
await db`delete from appointments where id = any(${[withNote, empty]})`;

if (errors.length) fail(`page errors: ${errors.join("; ")}`);
await browser.close();
await db.end();
console.log("report-card OK");
