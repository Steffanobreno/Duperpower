// Abandoned online bookings, end to end. Run after slice.mjs and booking.mjs.
// Someone types phone, name, email and address on /book and stops → the draft is saved →
// (the shell then runs the reminder step) → the owner sees it under Booking requests with
// Text / Call / Clear, and the "finish" link opens /book with the phone filled in.
// Usage: STAGE=start|after node tests/e2e/abandoned.mjs [baseUrl]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const STAGE = process.env.STAGE ?? "start";
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
const button = (name) => page.getByRole("button", { name, exact: true });

if (STAGE === "start") {
  await page.goto(`${BASE}/book`);
  await page.getByLabel("Mobile phone").fill("6505550166");
  await button("Next").click();
  await page.getByText("It looks like your first visit with us.").waitFor();
  await page.getByLabel("First name").fill("Lily");
  await page.getByLabel("Last name").fill("Left");
  await page.getByLabel("Email").fill("lily@example.com");
  await button("Continue").click();
  await page.getByLabel("Street address").fill("3 Bay St");
  await page.getByLabel("City").fill("San Mateo");
  await page.getByLabel("ZIP code").fill("94402");
  await button("Continue").click();
  await page.getByLabel("Breed").waitFor();
  await page.waitForTimeout(1500); // the tracking call is fire-and-forget
  step("started a booking and stopped at the pet step");
} else {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', "owner@example.com");
  await page.fill('input[name="password"]', "correct horse battery");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/today/);
  await page.goto(`${BASE}/requests`);
  await page.getByText("Didn't finish booking online").waitFor();
  const card = page.locator("div", { hasText: "Lily Left" }).filter({ hasText: "Stopped after the address" }).last();
  await card.waitFor();
  await card.getByText(/Sent them a link to finish/).waitFor();
  if (!(await card.getByRole("link", { name: "Call" }).getAttribute("href")).startsWith("tel:+16505550166")) fail("call link wrong");
  step("owner sees Lily under 'Didn't finish booking online' with Text / Call");

  await page.goto(`${BASE}/book?phone=6505550166`);
  if ((await page.getByLabel("Mobile phone").inputValue()).replace(/\D/g, "") !== "6505550166") fail("finish link should fill the phone");
  step("the finish link opens the booking page with the phone filled in");

  await page.goto(`${BASE}/requests`);
  await page.locator("div", { hasText: "Lily Left" }).getByRole("button", { name: "Clear" }).last().click();
  await page.getByText("Lily Left").waitFor({ state: "detached" });
  step("Clear removes it from the list");
}
if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("All good.");
