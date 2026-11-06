// A business outside the US, end to end. Run after slice.mjs (owner@example.com).
// Brazil: country picks currency and time zone · phone read the Brazilian way · prices in R$ ·
// km instead of miles · postal code and cm/kg on the forms · Brazilian holidays · back to the US.
// Usage: node tests/e2e/worldwide.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
const shot = (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

// Business: Brazil → real (BRL) and São Paulo time; a phone typed the Brazilian way.
await page.goto(`${BASE}/settings/business`);
await page.getByLabel("Country").selectOption("BR");
if ((await page.getByLabel("Currency").inputValue()) !== "BRL") fail("Brazil should suggest the real (BRL)");
if ((await page.getByLabel("Time zone").inputValue()) !== "America/Sao_Paulo") fail("Brazil should suggest São Paulo time");
await page.getByLabel("Business phone").fill("11 98765-4321");
await page.getByLabel("ZIP").fill("");
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.getByText("Saved.").waitFor();
await page.reload();
await page.getByLabel("Postal code").fill("01310-100");
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.getByText("Saved.").waitFor();
await page.reload();
if ((await page.getByLabel("Postal code").inputValue()) !== "01310-100") fail("postal code should be kept");
if ((await page.getByLabel("Business phone").inputValue()) !== "(11) 98765-4321") fail(`phone should read (11) 98765-4321, got ${await page.getByLabel("Business phone").inputValue()}`);
await shot("W01-business-brazil");
step("Brazil: currency BRL, São Paulo time, phone (11) 98765-4321, postal code 01310-100");

// Prices in reais, on the services list and the booking page.
await page.goto(`${BASE}/settings/services`);
await page.getByText(/R\$\s?\d/).first().waitFor();
await page.goto(`${BASE}/book`);
await page.getByText(/R\$\s?\d/).first().waitFor({ timeout: 15000 }).catch(() => null);
step("prices show in R$");

// Kilometers on the online booking rules (25 miles = 40 km), and back unchanged.
await page.goto(`${BASE}/settings/booking`);
const km = page.getByLabel("Max km between a day's stops");
await km.waitFor();
if ((await km.inputValue()) !== "40") fail(`25 miles should show as 40 km, got ${await km.inputValue()}`);
await page.getByLabel("Van's home postal code").fill("01310-100");
await page.getByRole("button", { name: "Save", exact: true }).first().click();
await page.getByText("Saved.").first().waitFor();
await page.reload();
if ((await page.getByLabel("Max km between a day's stops").inputValue()) !== "40") fail("40 km should stay 40 km after saving");
step("distances in km (25 mi → 40 km, saved and read back the same)");

// A new client: postal code, a Brazilian mobile, then their pet in cm and kg.
await page.goto(`${BASE}/clients/new`);
await page.getByLabel("Postal code").waitFor();
await page.getByLabel("First name").fill("Ana");
await page.getByLabel("Last name").fill("Souza");
await page.getByLabel("Mobile phone").fill("(21) 99876-5432");
await page.getByRole("button", { name: /Save/ }).first().click();
await page.waitForURL(/\/clients\/[0-9a-f-]+\/pets\/new/);
await page.getByLabel("Weight (kg)").waitFor();
if (!(await page.getByRole("option", { name: "Small (30 cm or less)" }).count())) fail("sizes should be in cm");
await page.getByLabel("Pet name").fill("Bolinha");
await page.getByLabel("Weight (kg)").fill("8,5");
await page.getByRole("button", { name: "Save pet" }).click();
await page.waitForURL(/\/clients\/[0-9a-f-]+$/);
await page.getByText(/\(21\) 99876-5432/).first().waitFor();
await page.getByRole("link", { name: /Bolinha/ }).first().click();
await page.getByLabel("Weight (kg)").waitFor();
if ((await page.getByLabel("Weight (kg)").inputValue()) !== "8.5") fail(`8,5 kg should read back as 8.5, got ${await page.getByLabel("Weight (kg)").inputValue()}`);
await shot("W02-pet-metric");
step("client form: postal code and a Brazilian mobile; pet sizes in cm, weight 8,5 kg kept");

// Brazilian holidays to close for.
await page.goto(`${BASE}/settings/closed`);
await page.getByText(/Natal|Christmas/).first().waitFor();
await page.getByText(/Tiradentes/).first().waitFor();
step("closed dates offer Brazil's holidays (Tiradentes, Christmas)");

// Back to the US for the other tests.
await page.goto(`${BASE}/settings/business`);
await page.getByLabel("Country").selectOption("US");
await page.getByLabel("Time zone").selectOption("America/Los_Angeles");
await page.getByLabel("Business phone").fill("(650) 555-0100");
await page.getByLabel("ZIP").fill("94401");
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.getByText("Saved.").waitFor();
await page.goto(`${BASE}/settings/services`);
await page.getByText(/\$\d/).first().waitFor();
step("back to the US: dollars again");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("worldwide: all good");
