// Service areas and the groomer's route, end to end. Run after slice.mjs (Maria Lopez, ZIP 94305).
// An area "South" (Palo Alto/Stanford ZIPs) on Tuesdays and Thursdays → Maria only sees those days
// online · a ZIP outside every area can't book · the Today route starts at the groomer's home.
// Usage: node tests/e2e/areas.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const newPage = async () => {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
};
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

const owner = await newPage();
await owner.goto(`${BASE}/login`);
await owner.fill('input[name="email"]', "owner@example.com");
await owner.fill('input[name="password"]', "correct horse battery");
await owner.click('button[type="submit"]');
await owner.waitForURL(/\/today/);

await owner.goto(`${BASE}/settings/areas`);
await owner.getByText("No service areas yet").waitFor();
await owner.getByRole("link", { name: "Add area" }).click();
await owner.getByLabel("Area name").fill("South");
await owner.getByLabel(/ZIP codes or cities/).fill("Palo Alto, 94305, Atlantis");
for (const d of ["Mon", "Wed", "Fri", "Sat"]) await owner.getByText(d, { exact: true }).click();
await owner.getByRole("button", { name: "Save area" }).click();
await owner.getByText("Not found in California: Atlantis.").waitFor();
await owner.getByLabel(/ZIP codes or cities/).fill("Palo Alto, 94305");
await owner.getByRole("button", { name: "Save area" }).click();
await owner.waitForURL(/\/settings\/areas$/);
await owner.getByRole("link", { name: /South.*Tue, Thu/ }).waitFor();
await owner.getByRole("img", { name: "Map of the service areas" }).waitFor();
if (SHOTS) await owner.screenshot({ path: `${SHOTS}/A01-areas.png`, fullPage: true });
step("an area from a city name and a ZIP, on Tuesdays and Thursdays; unknown places are refused");

// Maria (94305) only gets Tuesdays and Thursdays online.
const client = await newPage();
const button = (name) => client.getByRole("button", { name, exact: true });
await client.goto(`${BASE}/book`);
await client.getByLabel("Mobile phone").fill("650-555-0142");
await button("Next").click();
await client.getByText("Welcome back, Maria!").waitFor();
await button("Continue").click();
await button("Continue to service").click();
await client.getByRole("radiogroup", { name: "Service" }).getByRole("radio").first().click();
await button("Continue").click();
await client.getByRole("radio", { name: "No", exact: true }).click();
await button("Confirm info for Biscuit").click();
await client.getByRole("heading", { name: "Select a time" }).waitFor();
const open = await client.locator("button[aria-label*='open time']:not([disabled])").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
if (!open.length) fail("Maria should have open days");
const wrong = open.filter((l) => !/^(Tuesday|Thursday)/.test(l));
if (wrong.length) fail(`only Tuesdays and Thursdays, got ${wrong.join(" | ")}`);
step(`Maria's open days online are all Tuesdays and Thursdays (${open.length})`);

// A new client outside the area.
const other = await newPage();
const b2 = (name) => other.getByRole("button", { name, exact: true });
await other.goto(`${BASE}/book`);
await other.getByLabel("Mobile phone").fill("650-555-0188");
await b2("Next").click();
await other.getByLabel("First name").fill("Tom");
await other.getByLabel("Last name").fill("Lee");
await other.getByLabel("Email").fill("tom@example.com");
await b2("Continue").click();
await other.getByLabel("Street address").fill("1 Main St");
await other.getByLabel("City").fill("San Mateo");
await other.getByLabel("ZIP code").fill("94401");
await b2("Continue").click();
await other.getByLabel("Breed").fill("malt");
await b2("Maltese").click();
await other.getByLabel("Pet's name").fill("Kiki");
await other.getByRole("radio", { name: /^Small/ }).click();
await b2("Save Kiki").click();
await b2("Continue to service").click();
await other.getByRole("radiogroup", { name: "Service" }).getByRole("radio").first().click();
await b2("Continue").click();
await other.getByRole("radio", { name: "No", exact: true }).click();
await b2("Confirm info for Kiki").click();
await other.getByText("outside our service area").waitFor();
step("a San Mateo address (outside every area) is told it's outside the service area");

// The groomer's day starts at home.
await owner.goto(`${BASE}/settings/team`);
await owner.getByRole("link", { name: /Owner/ }).first().click();
await owner.getByLabel("Van", { exact: true }).fill("Ford Transit 2019");
await owner.getByLabel(/Day starts at/).fill("100 Home St, San Mateo, CA");
await owner.getByRole("button", { name: "Save van and route" }).click();
await owner.getByText("Saved.").first().waitFor();
const date = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
await owner.goto(`${BASE}/today?date=${date}`);
const href = await owner.locator('a[href*="google.com/maps/dir"]').filter({ hasText: /route/i }).first().getAttribute("href");
if (!href || !new URL(href).searchParams.get("origin")?.includes("100 Home St")) fail(`route should start at home: ${href}`);
step("the Today route starts at the groomer's home");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
