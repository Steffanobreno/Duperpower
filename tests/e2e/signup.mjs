// Many businesses, end to end. Run after slice.mjs (Woofers Dog Spa with Maria Lopez), with
// DATABASE_URL. Two groomers sign up → each skips the first-run setup and lands on Today with the welcome steps, has its own
// services and booking link (/book/<slug>) under its own name; neither can open the other's
// clients or visits; the first business's /book still works.
// Usage: node tests/e2e/signup.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const db = postgres(process.env.DATABASE_URL);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const newPage = async () => {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
};

const signUp = async (business, name, email) => {
  const page = await newPage();
  await page.goto(`${BASE}/login`);
  await page.getByRole("link", { name: "Create your business account" }).click();
  await page.waitForURL(/\/signup/);
  await page.getByLabel("Business name").fill(business);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a good long password");
  await page.getByLabel("Business phone").fill("(415) 555-0100");
  await page.getByLabel("ZIP code").fill("94110");
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create my account" }).click();
  // The first-run setup opens; skipping it lands on Today with the welcome steps.
  await page.waitForURL(/\/welcome/);
  await page.getByText("Step 1 of 5").first().waitFor();
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.waitForURL(/\/today/);
  await page.getByText("Welcome! Set up in a few minutes").waitFor();
  return page;
};

const a = await signUp("Happy Paws Mobile Grooming", "Ana", "ana@happypaws.test");
if (SHOTS) await a.screenshot({ path: `${SHOTS}/N01-welcome.png` });
const b = await signUp("Happy Paws Mobile Grooming", "Bea", "bea@otherpaws.test");
const slugs = await db`select name, booking_slug from businesses order by created_at`;
if (slugs.length !== 3) fail(`3 businesses expected, got ${slugs.length}`);
if (slugs[1].booking_slug !== "happy-paws-mobile-grooming" || slugs[2].booking_slug !== "happy-paws-mobile-grooming-2") {
  fail(`booking links should be unique: ${slugs.map((s) => s.booking_slug)}`);
}
const [{ n }] = await db`select count(*)::int as n from services s join businesses b on b.id = s.business_id where b.booking_slug = 'happy-paws-mobile-grooming'`;
if (n < 8) fail("a new business should start with the starter services");
step("two groomers sign up: each lands on Today with the welcome steps, its own services and a unique booking link");

// The same email can't sign up twice.
const again = await newPage();
await again.goto(`${BASE}/signup`);
await again.getByLabel("Business name").fill("Again");
await again.getByLabel("Your name").fill("Ana");
await again.getByLabel("Email").fill("ana@happypaws.test");
await again.getByLabel("Password").fill("a good long password");
await again.getByLabel(/I agree to the/).check();
await again.getByRole("button", { name: "Create my account" }).click();
await again.getByText(/already an account with that email/).waitFor();
step("an email that already has an account is refused");

// Each booking page is the business's own.
const client = await newPage();
await client.goto(`${BASE}/book/happy-paws-mobile-grooming`);
await client.getByText("Happy Paws Mobile Grooming").first().waitFor();
if (await client.getByText("Woofers").count()) fail("a new business's booking page shouldn't show Woofers");
await client.goto(`${BASE}/book`);
await client.getByRole("link", { name: /Woofers Dog Spa home/ }).waitFor();
const missing = await client.goto(`${BASE}/book/no-such-groomer`);
if (missing.status() !== 404) fail(`an unknown booking link should be 404, got ${missing.status()}`);
step("/book/<slug> shows that business; /book is still Woofers; an unknown link is 404");

// Ana adds a client; Bea can't open it, nor Woofers' visit.
await a.goto(`${BASE}/clients/new`);
await a.locator('input[name="first_name"]').fill("Zara");
await a.locator('input[name="phone"]').fill("(415) 555-0199");
await a.getByRole("button", { name: /Save/ }).first().click();
await a.waitForURL(/\/clients\/[0-9a-f-]{36}/);
const zara = a.url().match(/clients\/([0-9a-f-]{36})/)[1];
const [{ visit }] = await db`select a.id as visit from appointments a join businesses b on b.id = a.business_id where b.booking_slug = 'woofers' limit 1`;
// (The page streams, so "not found" can come with status 200: what matters is that nothing shows.)
await b.goto(`${BASE}/clients/${zara}`);
await b.getByText(/could not be found|not found/i).first().waitFor();
if (await b.getByText("Zara").count()) fail("Bea can open Ana's client");
await b.goto(`${BASE}/appointments/${visit}`);
await b.getByText(/could not be found|not found/i).first().waitFor();
if (await b.getByText("Maria").count()) fail("Bea can open Woofers' visit");
await b.goto(`${BASE}/clients`);
if (await b.getByText("Zara").count()) fail("Bea's client list shows Ana's client");
step("each business sees only its own clients and visits");

await db.end();
await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
