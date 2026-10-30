// Agreement options, end to end. Run after slice.mjs (Maria Lopez, not signed), with DATABASE_URL.
// Send-to-sign buttons on the profile · Maria signs from her link (in Portuguese) · the profile
// shows it · "sign on every booking" asks her again online.
// Usage: node tests/e2e/agreement-options.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const db = postgres(process.env.DATABASE_URL);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const newPage = async (locale = "en-US") => {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale })).newPage();
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

const [maria] = await db`select id, sign_token from clients where first_name = 'Maria'`;
await db`delete from agreement_signatures where client_id = ${maria.id}`;
await owner.goto(`${BASE}/clients/${maria.id}`);
const text = owner.getByRole("link", { name: "Text sign link" });
if (!decodeURIComponent(await text.getAttribute("href")).includes(`/s/${maria.sign_token}`)) fail("the text should carry the sign link");
await owner.getByRole("button", { name: "Copy link" }).waitFor();
step("the profile offers to text, email or copy the sign link");

const client = await newPage("pt-BR");
await client.goto(`${BASE}/s/${maria.sign_token}`);
await client.getByText("Leia e assine nosso contrato de serviço.").waitFor();
await client.locator('input[name="agree"]').check();
await client.locator('input[name="signature"]').fill("Maria Lopez");
if (SHOTS) await client.screenshot({ path: `${SHOTS}/G01-sign-link.png`, fullPage: true });
await client.locator('button[type="submit"]').click();
await client.getByText("Obrigado! Você assinou o contrato de serviço.").waitFor();
await owner.reload();
await owner.getByText(/Agreement signed .* by "Maria Lopez"/).waitFor();
step("Maria signs from her link (in Portuguese); the profile shows it");

// Sign on every booking: asked again online even though she signed.
await owner.goto(`${BASE}/settings/agreement`);
await owner.getByLabel("Sign on every online booking (instead of once a year)").check();
await owner.getByRole("button", { name: "Save", exact: true }).click();
await owner.getByText("Saved.").waitFor();
const [a] = await db`select sign_every_booking from agreements where active`;
if (!a.sign_every_booking) fail("option not saved");
const booker = await newPage();
const button = (name) => booker.getByRole("button", { name, exact: true });
await booker.goto(`${BASE}/book`);
await booker.getByLabel("Mobile phone").fill("650-555-0142");
await button("Next").click();
await booker.getByText("Welcome back, Maria!").waitFor();
await button("Continue").click();
await button("Continue to service").click();
await booker.getByRole("radiogroup", { name: "Service" }).getByRole("radio").first().click();
await button("Continue").click();
await booker.getByRole("radio", { name: "No", exact: true }).click();
await button("Confirm info for Biscuit").click();
await booker.locator("button[aria-label*='open time']:not([disabled])").first().click();
await booker.getByRole("group", { name: "Open times" }).locator("button").first().click();
await booker.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
await booker.getByRole("button", { name: /Read and sign/ }).waitFor();
step("with “sign on every booking”, Maria is asked to sign again online");

await db.end();
await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
