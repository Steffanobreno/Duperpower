// Editing a booked visit's pets and services, end to end. Run after slice.mjs (Maria Lopez with
// Biscuit), with DATABASE_URL. On a booked visit: change Bath for Full Haircut, a custom price
// kept for Biscuit's next visits, add Maria's other dog (Luna) with a bath → saved; then take
// Luna off again.
// Usage: node tests/e2e/edit-services.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const db = postgres(process.env.DATABASE_URL);
const [{ client, biscuit }] = await db`select c.id as client, p.id as biscuit from clients c join pets p on p.client_id = c.id
                                      where c.first_name = 'Maria' and p.name = 'Biscuit'`;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

// A booked visit for Biscuit only (Bath - Medium). Luna joins Maria's dogs afterwards.
const day = new Date(Date.now() + 6 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
await page.goto(`${BASE}/appointments/new?client=${client}&date=${day}&time=10:00`);
const sel = page.locator('select[name^="svc:"]').first();
await sel.selectOption(await sel.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
await page.getByLabel(/Send the confirmation/).uncheck();
await page.getByRole("button", { name: "Book appointment" }).click();
await page.waitForURL(/\?booked=1/);
const id = page.url().split("/").pop().split("?")[0];
await db`insert into pets (client_id, name, breed, size_class) values (${client}, 'Luna', 'Poodle', 'medium')`;

await page.goto(`${BASE}/appointments/${id}/services`);
const change = page.getByRole("combobox", { name: /^Change Bath/ });
const haircut = await change.locator("option", { hasText: "Full Haircut - Medium" }).getAttribute("value");
await change.selectOption(haircut);
const price = page.getByLabel(/^Price of Full Haircut - Medium/);
const menu = Number(await price.inputValue());
if (!(menu > 0)) fail("changing the service should bring its price");
await price.fill("99");
await page.getByText("Keep $99.00 for Biscuit on future visits").click();
step(`Bath changed for Full Haircut ($${menu} on the menu), custom $99 kept for Biscuit`);

await page.getByLabel("Add a pet").selectOption({ label: "Luna · Poodle" });
const lunaAdd = page.getByLabel("Add a service for Luna");
await lunaAdd.selectOption(await lunaAdd.locator("option", { hasText: "Bath - Medium" }).first().getAttribute("value"));
if (SHOTS) await page.screenshot({ path: `${SHOTS}/E01-edit-services.png`, fullPage: true });
await page.getByRole("button", { name: "Save changes" }).click();
await page.waitForURL(new RegExp(`/appointments/${id}$`));
const rows = await db`
  select p.name as pet, s.name, s.price_cents from appointment_services s join appointment_pets ap on ap.id = s.appointment_pet_id
  join pets p on p.id = ap.pet_id where ap.appointment_id = ${id} order by p.name`;
if (rows.length !== 2 || rows[0].pet !== "Biscuit" || !rows[0].name.startsWith("Full Haircut") || rows[0].price_cents !== 9900 || rows[1].pet !== "Luna") {
  fail(`the visit should have Biscuit's haircut at $99 and Luna's bath: ${JSON.stringify(rows)}`);
}
const [own] = await db`select price_cents from pet_service_prices where pet_id = ${biscuit} and service_id = ${haircut}`;
if (own?.price_cents !== 9900) fail("Biscuit's own price for the haircut should be $99 now");
step("saved: Biscuit's haircut at $99 (kept on his profile) and Luna added with a bath");

// Biscuit's menu now shows his own price; take Luna off again.
await page.goto(`${BASE}/appointments/${id}/services`);
const add = page.getByLabel("Add a service for Biscuit");
if (!(await add.locator("option", { hasText: "Full Haircut - Medium" }).first().textContent()).includes("$99.00")) {
  fail("Biscuit's menu should show his own $99 haircut");
}
await page.getByRole("button", { name: "Remove Luna" }).click();
await page.getByRole("button", { name: "Save changes" }).click();
await page.waitForURL(new RegExp(`/appointments/${id}$`));
const pets = await db`select p.name from appointment_pets ap join pets p on p.id = ap.pet_id where ap.appointment_id = ${id}`;
if (pets.length !== 1 || pets[0].name !== "Biscuit") fail(`only Biscuit should be left: ${pets.map((p) => p.name)}`);
step("Biscuit's menu shows his own $99; Luna taken off the visit");

await db.end();
await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
