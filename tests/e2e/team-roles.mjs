// Team logins, roles, clock and payroll, end to end. Run after slice.mjs (Maria's finished,
// paid visit on VISIT_DATE: $194 + $38.80 tip).
// Add a groomer with a login → she logs in: only her visits, no reports or settings → the owner
// allows reports → she clocks in and out → her pay → the visit given to her shows in payroll.
// Usage: VISIT_DATE=yyyy-mm-dd node tests/e2e/team-roles.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const DATE = process.env.VISIT_DATE;
if (!DATE) throw new Error("Set VISIT_DATE");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const newPage = async () => {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  return p;
};
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const login = async (p, email, password) => {
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', password);
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/today/);
};

const owner = await newPage();
await login(owner, "owner@example.com", "correct horse battery");

// Find Maria's visit before there are two groomers.
await owner.goto(`${BASE}/calendar?view=day&date=${DATE}`);
const visitHref = await owner.locator('section[aria-label="Day schedule"] a[href^="/appointments/"]').first().getAttribute("href");

// A new groomer with a login.
await owner.goto(`${BASE}/settings/team`);
await owner.getByLabel("Name").fill("Ana");
await owner.getByRole("button", { name: "Add groomer" }).click();
await owner.getByText("Added.").waitFor();
await owner.getByRole("link", { name: /^A\s*Ana/ }).click();
await owner.getByLabel("Login email").fill("ana@example.com");
await owner.getByLabel("Password").fill("ana-password-123");
await owner.getByRole("button", { name: "Give a login" }).click();
await owner.getByText(/Login saved/).waitFor();
await owner.getByLabel("Commission %").fill("50");
await owner.getByLabel("Hourly pay ($)").fill("20");
await owner.getByRole("button", { name: "Save pay" }).click();
await owner.getByText("Saved.").last().waitFor();
if (SHOTS) await owner.screenshot({ path: `${SHOTS}/T01-team-member.png`, fullPage: true });
step("owner adds Ana as a groomer with a login and 50% commission, $20/h");

// Ana logs in: her own route only; no reports or settings.
const ana = await newPage();
await login(ana, "ana@example.com", "ana-password-123");
if (await ana.getByRole("link", { name: "Reports" }).count()) fail("a groomer shouldn't see Reports");
await ana.goto(`${BASE}${visitHref}`);
await ana.getByText(/not found|could not be found/i).first().waitFor();
await ana.goto(`${BASE}/settings/services`);
await ana.waitForURL(/\/today\?denied=1/);
await ana.getByText("Your role can't open that page.").waitFor();
await ana.goto(`${BASE}/settings`);
await ana.getByRole("link", { name: /Account/ }).waitFor();
if (await ana.getByRole("link", { name: /Services and prices/ }).count()) fail("a groomer shouldn't see the full settings");
await ana.goto(`${BASE}/reports`);
await ana.waitForURL(/denied=1/);
step("Ana sees only her own visits; settings and reports are closed to her");

// The owner allows reports for groomers.
await owner.goto(`${BASE}/settings/team/roles`);
await owner.getByLabel("Groomer: See reports, money totals and payroll").check();
await owner.getByRole("button", { name: "Save groomer permissions" }).click();
await owner.getByText("Saved.").waitFor();
await ana.goto(`${BASE}/today`);
await ana.getByRole("link", { name: "Reports" }).waitFor();
await ana.goto(`${BASE}/reports`);
await ana.getByRole("heading", { name: "Reports" }).waitFor();
step("after the owner allows it, Ana sees Reports");

// Clock in and out.
await owner.goto(`${BASE}/settings/team/clock`);
await owner.getByRole("button", { name: "Turn clock in/out on" }).click();
await owner.getByRole("button", { name: "Turn clock in/out off" }).waitFor();
await ana.goto(`${BASE}/today`);
await ana.getByRole("button", { name: "Clock in" }).click();
await ana.getByText("Clocked in since").waitFor();
await ana.getByRole("button", { name: "Clock out" }).click();
await ana.getByText("Not clocked in").waitFor();
await owner.reload();
await owner.getByRole("button", { name: /Edit Ana on/ }).click();
await owner.getByLabel("Clock in").fill("08:00");
await owner.getByLabel("Clock out").fill("12:00");
await owner.getByRole("button", { name: "Save" }).click();
await owner.getByText("4.0 h").first().waitFor();
step("Ana clocks in and out; the owner fixes the entry to 4 hours");

// Give Maria's visit to Ana; payroll for that day.
await owner.goto(`${BASE}${visitHref}`);
await owner.getByLabel("Give to").selectOption({ label: "Ana" });
await owner.getByRole("button", { name: "Give to" }).click();
await owner.waitForLoadState("networkidle");
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const [from, to] = [DATE, today].sort();
await owner.goto(`${BASE}/reports/payroll?from=${from}&to=${to}`);
const card = owner.getByRole("heading", { name: "Ana" }).locator("xpath=../..");
await card.getByText("Commission · 50% of $194.00 (1 visit)").waitFor();
await card.getByText("Hours · 4.0 h × $20.00").waitFor();
if (SHOTS) await owner.screenshot({ path: `${SHOTS}/T02-payroll.png`, fullPage: true });
const total = await card.locator("span.text-xl").textContent();
// $97 commission + 100% of the $38.80 tip + 4 h × $20.
if (total !== "$215.80") fail(`Ana's pay should be $215.80, is ${total}`);
step("payroll: Ana gets $97 commission + $38.80 tips + $80 hours = $215.80");

// The visit is now Ana's: she can open it.
await ana.goto(`${BASE}${visitHref}`);
await ana.getByText("Maria Lopez").first().waitFor();
step("the visit given to Ana opens for her");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
