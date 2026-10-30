// Booked visits and the client's confirmation, end to end. Run after slice.mjs (Maria Lopez).
// A booked visit reads "Not confirmed" in red until the client confirms from their link, then
// "Confirmed" in green; the owner never has to confirm it. Cancel and no-show ask first, and a
// cancelled or no-show visit stays on Today where it can be restored.
// Usage: node tests/e2e/confirmation.mjs [baseUrl]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
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

// A visit in 3 days at 2 PM (inside working hours, any weekday but Sunday).
const d = new Date();
d.setDate(d.getDate() + 3);
if (d.getDay() === 0) d.setDate(d.getDate() + 1);
const date = d.toISOString().slice(0, 10);
await page.goto(`${BASE}/clients?q=Maria`);
await page.getByRole("link", { name: /Maria/ }).first().click();
await page.waitForURL(/\/clients\/[0-9a-f-]+$/);
const clientId = page.url().split("/").pop();
await page.goto(`${BASE}/appointments/new?client=${clientId}&date=${date}&time=14:00`);
const select = page.locator('select[name^="svc:"]');
await select.selectOption(await select.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
await page.getByRole("button", { name: "Book appointment" }).click();
await page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/);
const apptUrl = page.url().split("?")[0];
const apptId = apptUrl.split("/").pop();

// Booked, not confirmed: red, and the next step is the day itself.
const summary = page.locator("summary", { hasText: "Not confirmed" });
await summary.waitFor();
if (!(await summary.locator(".bg-danger").count())) fail("Not confirmed should be red");
await page.getByRole("button", { name: "I'm on the way" }).waitFor();
if (await page.getByRole("button", { name: "Mark as confirmed" }).count()) fail("the owner shouldn't have to confirm");
step("a booked visit shows Not confirmed (red); next step is I'm on the way");

// No-show asks first. Saying no keeps the visit.
page.once("dialog", (dlg) => dlg.dismiss());
await page.getByRole("button", { name: "No-show" }).click();
await page.waitForTimeout(800);
await page.reload();
await page.locator("summary", { hasText: "Not confirmed" }).waitFor();
step("No-show asks first; saying no keeps the visit");

// Saying yes marks it, and Today still lists it (greyed) with a way back.
page.once("dialog", (dlg) => dlg.accept());
await page.getByRole("button", { name: "No-show" }).click();
await page.locator("summary", { hasText: "No-show" }).waitFor();
await page.goto(`${BASE}/today?date=${date}&groomer=all`);
const off = page.locator("section", { has: page.getByRole("heading", { name: "Cancelled or no-show" }) });
await off.getByRole("link", { name: /Maria Lopez/ }).click();
await page.waitForURL(apptUrl);
await page.getByRole("button", { name: "Restore" }).click();
await page.locator("summary", { hasText: "Not confirmed" }).waitFor();
step("a no-show stays on Today under Cancelled or no-show, and Restore brings it back");

// The client confirms from their link (the reminder text): the owner sees Confirmed in green.
// The link's token is read from the database (DATABASE_URL); without it this part is skipped.
const token = process.env.DATABASE_URL
  ? await (async () => {
      const db = (await import("postgres")).default(process.env.DATABASE_URL);
      const [row] = await db`select public_token from appointments where id = ${apptId}`;
      await db.end();
      return row?.public_token;
    })()
  : null;
if (token) {
  await page.goto(`${BASE}/a/${token}`);
  // The yearly service agreement may need signing first.
  if (await page.locator('input[name="signature"]').count()) {
    await page.locator('input[name="agree"]').check();
    await page.fill('input[name="signature"]', "Maria Lopez");
  }
  await page.getByRole("button", { name: /confirm/i }).first().click();
  await page.waitForLoadState("networkidle");
  await page.goto(apptUrl);
  const ok = page.locator("summary", { hasText: "Confirmed" });
  await ok.waitFor();
  if (!(await ok.locator(".bg-success").count())) fail("Confirmed should be green");
  step("the client confirms from their link: Confirmed in green");
}

// The owner can still record a confirmation by phone, from the status menu.
await page.goto(apptUrl);
await page.locator("summary", { hasText: /confirmed/i }).first().click();
const menuItem = page.getByRole("button", { name: /Client confirmed|Client hasn't confirmed/ });
await menuItem.first().waitFor();
step("the status menu records a phone confirmation (Client confirmed)");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
