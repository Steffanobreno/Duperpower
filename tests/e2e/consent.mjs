// Text-message consent: every form starts with the box unchecked, the source of the consent is
// recorded, a returning client keeps the consent they gave, a CSV import only records consent when
// the owner attests to it, and the unsubscribe page speaks the client's language.
// Run after slice.mjs on the same database. Usage: node tests/e2e/consent.mjs [baseUrl]
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = postgres(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/woofers", { max: 1 });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const button = (name) => page.getByRole("button", { name, exact: true });
const consentBox = () => page.getByRole("checkbox", { name: /Text me about my appointments/ });
const row = async (phone) => (await db`select sms_consent_at, sms_consent_source from clients where phone = ${phone}`)[0];

async function sign() {
  const pad = page.getByLabel("Draw your signature here");
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  await page.mouse.move(box.x + 30, box.y + 60);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 30 + i * 18, box.y + 60 + (i % 2 ? 25 : -25));
  await page.mouse.up();
}

// Picks a time and arrives at the last screen, where the text-message box is.
async function pickTimeAndReview() {
  await page.getByRole("heading", { name: "Select a time" }).waitFor();
  await page.getByRole("group", { name: "Open times" }).locator("button").first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
}
async function signIfAsked() {
  const read = page.getByRole("button", { name: /Read and sign/ });
  if (await read.count()) {
    await read.click();
    await page.getByLabel("I have read and agree to the service agreement.").check();
    await page.getByLabel("Type your full name to sign").fill("Ana Silva");
    await sign();
    await button("Sign agreement").click();
    await page.getByText("Signed by Ana Silva").waitFor();
  }
}

// 1. The owner's own forms and the intake form start unchecked.
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
await page.goto(`${BASE}/clients/new`);
if (await page.locator('input[name="sms_consent"]').isChecked()) fail("the new-client form starts with consent checked");
step("the owner's new-client form starts with the box unchecked");
await page.goto(`${BASE}/intake`);
if (await page.locator('input[name="sms_consent"]').isChecked()) fail("the intake form starts with consent checked");
step("the intake form starts with the box unchecked");

// 2. A new client books with the box checked: consent and source 'booking'.
const tail = String(1000 + Math.floor(Math.random() * 8000)); // a phone nobody used before
const phone = `(650) 555-${tail}`;
const bookedPhone = `+1650555${tail}`;
await page.goto(`${BASE}/book`);
await page.getByLabel("Mobile phone").fill(phone);
await button("Next").click();
await page.getByLabel("First name").fill("Consent");
await page.getByLabel("Last name").fill("Tester");
await page.getByLabel("Email").fill("consent@example.com");
await button("Continue").click();
await page.getByLabel("Street address").fill("1 Main St");
await page.getByLabel("City").fill("San Mateo");
await page.getByLabel("ZIP code").fill("94401");
await button("Continue").click();
await page.getByLabel("Breed").fill("malt");
await button("Maltese").click();
await page.getByLabel("Pet's name").fill("Nori");
await page.getByRole("radio", { name: /^Small/ }).click();
await button("Save Nori").click();
await button("Continue to service").click();
await page.getByRole("radiogroup", { name: "Category" }).getByRole("radio", { name: "Bath", exact: true }).click();
await page.getByRole("radiogroup", { name: "Service" }).getByRole("radio").first().click();
await button("Continue").click();
await page.getByRole("radio", { name: "No", exact: true }).click();
await button("Confirm info for Nori").click();
await pickTimeAndReview();
await signIfAsked();
if (await consentBox().isChecked()) fail("the booking page starts with consent checked");
step("the booking page starts with the box unchecked");
await consentBox().check();
await button("Submit booking request").click();
await page.getByText("Waiting for confirmation").waitFor();
let r = await row(bookedPhone);
if (!r?.sms_consent_at || r.sms_consent_source !== "booking") fail(`booking with the box: ${JSON.stringify(r)}`);
step("booking with the box checked stores consent, source 'booking'");

// 3. A returning client who already consented books with the box unchecked and keeps it.
await db`update clients set sms_consent_at = now(), sms_consent_source = 'manual' where phone = '+16505550142'`;
await page.goto(`${BASE}/book`);
await page.getByLabel("Mobile phone").fill("650-555-0142");
await button("Next").click();
await page.getByRole("heading", { name: "Welcome back, Maria!" }).waitFor();
await button("Continue").click();
await button("Continue to service").click();
await page.getByRole("radiogroup", { name: "Service" }).getByRole("radio").first().click();
await button("Continue").click();
await page.getByRole("radio", { name: "No", exact: true }).click();
await page.getByRole("button", { name: /^Confirm info for/ }).click();
await pickTimeAndReview();
await signIfAsked();
if (await consentBox().isChecked()) fail("the returning client's box starts checked");
await button("Submit booking request").click();
await page.getByText("Waiting for confirmation").waitFor();
r = await row("+16505550142");
if (!r?.sms_consent_at || r.sms_consent_source !== "manual") fail(`returning client lost consent: ${JSON.stringify(r)}`);
step("a returning client books with the box unchecked and keeps the consent they gave");

// 4. CSV import: without the attestation no consent; with it, import_attested.
const dir = mkdtempSync(join(tmpdir(), "consent-"));
async function importCsv(name, phoneDigits, attest) {
  const path = join(dir, `${name}.csv`);
  writeFileSync(path, `Name,Mobile,Email\n${name} Import,${phoneDigits},\n`);
  await page.goto(`${BASE}/settings/import`);
  const attestation = page.getByRole("checkbox", { name: /I have written consent from these clients to text them/ });
  if (await attestation.isChecked()) fail("the import attestation starts checked");
  if (attest) await attestation.check();
  await page.setInputFiles('input[type="file"]', path);
  await page.locator('form button[type="submit"]').last().click();
  await page.getByText(/1 clients and 0 pets imported/).waitFor();
}
const plainPhone = `650-555-${Number(tail) + 1}`, attestedPhone = `650-555-${Number(tail) + 2}`;
await importCsv("Plain", plainPhone, false);
r = await row(`+1${plainPhone.replaceAll("-", "")}`);
if (!r || r.sms_consent_at || r.sms_consent_source) fail(`import without attestation: ${JSON.stringify(r)}`);
step("an import without the attestation stores no consent");
await importCsv("Attested", attestedPhone, true);
r = await row(`+1${attestedPhone.replaceAll("-", "")}`);
if (!r?.sms_consent_at || r.sms_consent_source !== "import_attested") fail(`import with attestation: ${JSON.stringify(r)}`);
step("an import with the attestation stores consent, source 'import_attested'");

// 5. The unsubscribe page in Spanish.
const [{ marketing_token }] = await db`select marketing_token from clients where phone = '+16505550142'`;
await page.goto(`${BASE}/u/${marketing_token}?lang=es`);
await page.getByRole("button", { name: "Darme de baja" }).waitFor();
if (await page.getByText("Unsubscribe", { exact: false }).count()) fail("English text left on the Spanish unsubscribe page");
step("/u/<token>?lang=es is in Spanish");

await browser.close();
await db.end();
console.log("All good.");
