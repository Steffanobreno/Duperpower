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

if (errors.length) fail(`page errors: ${errors.join("; ")}`);
await browser.close();
await db.end();
console.log("report-card OK");
