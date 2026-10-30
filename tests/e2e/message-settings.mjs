// Message settings, end to end. Run after slice.mjs (Maria Lopez with email, texts allowed), with
// DATABASE_URL set to read the outbox.
// Booking confirmation by email only · arrival window in the text · 2nd reminder on with its days ·
// receipt email switch.
// Usage: node tests/e2e/message-settings.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const db = postgres(process.env.DATABASE_URL);
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
const day = (n) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

await page.goto(`${BASE}/settings/messages`);
await page.getByRole("button", { name: /^Turn automatic messages/ }).waitFor();
if (await page.getByRole("button", { name: "Turn automatic messages on" }).count()) {
  await page.getByRole("button", { name: "Turn automatic messages on" }).click();
  await page.getByRole("button", { name: "Turn automatic messages off" }).waitFor();
}
// Arrival window 0 / 45 and no receipt emails.
await page.getByLabel("Minutes after", { exact: true }).fill("45");
await page.getByLabel("Email the receipt when an order is paid in full").uncheck();
await page.locator("form", { has: page.getByLabel("Minutes after", { exact: true }) }).getByRole("button", { name: "Save" }).click();
await page.getByText("Saved.").first().waitFor();

const template = (title) => page.locator("details", { has: page.locator("summary", { hasText: title }) });
// Booking confirmation: email only.
await template("Booking confirmation").locator("summary").click();
await template("Booking confirmation").getByLabel("Text (SMS)").uncheck();
await template("Booking confirmation").getByRole("button", { name: "Save" }).click();
await template("Booking confirmation").getByText("Saved.").waitFor();
// 2nd reminder: on, 1 day before.
const second = template("2nd reminder");
await second.locator("summary").getByText("Off").waitFor();
await second.locator("summary").click();
await second.getByLabel("Send this message").check();
await second.getByLabel("Days before the visit").fill("1");
await second.getByRole("button", { name: "Save" }).click();
await second.getByText("Saved.").waitFor();
await page.reload();
await template("Booking confirmation").locator("summary").getByText("Email").waitFor();
if (await template("Booking confirmation").locator("summary").getByText("SMS").count()) fail("SMS should be off");
await template("2nd reminder").locator("summary").getByText("SMS").waitFor();
if (SHOTS) await page.screenshot({ path: `${SHOTS}/M01-messages.png`, fullPage: true });
step("booking confirmation by email only; 2nd reminder on; arrival window 45 min; receipt email off");

// Book Maria at 2 PM in 5 days with the confirmation.
const [maria] = await db`select id, email from clients where first_name = 'Maria'`;
if (!maria.email) await db`update clients set email = 'maria@example.com' where id = ${maria.id}`;
await page.goto(`${BASE}/appointments/new?client=${maria.id}&date=${day(5)}&time=14:00`);
const sel = page.locator('select[name^="svc:"]');
await sel.selectOption(await sel.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
await page.getByRole("button", { name: "Book appointment" }).click();
await page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/);
const apptId = page.url().split("/").pop().split("?")[0];
const sent = await db`select channel, body from messages where appointment_id = ${apptId} and template_trigger = 'booked'`;
if (sent.length !== 1 || sent[0].channel !== "email") fail(`expected one email, got ${JSON.stringify(sent.map((m) => m.channel))}`);
if (!sent[0].body.includes("2:00 PM – 2:45 PM")) fail(`arrival window missing: ${sent[0].body}`);
step("the booking confirmation went by email only, with “2:00 PM – 2:45 PM”");

await db.end();
await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
