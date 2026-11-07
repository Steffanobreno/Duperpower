// Receipts, end to end. Run after slice.mjs (Maria Lopez, pet Biscuit), with the app's email
// pointed at a local mail catcher (SMTP_HOST/SMTP_PORT) whose folder is MAIL_DIR.
// Finishing an order emails the receipt with the PDF → the client's receipt page and PDF →
// "Email again" → the receipt generator → the receipts list and the all-receipts PDF.
// Usage: MAIL_DIR=/path node tests/e2e/receipts.mjs [baseUrl] [screenshotDir]
import { readdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const MAIL_DIR = process.env.MAIL_DIR;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const shot = (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const mails = () => (MAIL_DIR ? readdirSync(MAIL_DIR).sort().map((f) => readFileSync(`${MAIL_DIR}/${f}`, "latin1")) : []);

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
await page.goto(`${BASE}/clients?q=Maria`);
await page.getByRole("link", { name: /Maria/ }).first().click();
await page.waitForURL(/\/clients\/[0-9a-f-]+$/);
const clientId = page.url().split("/").pop();

// Maria gets an email address.
await page.goto(`${BASE}/clients/${clientId}/edit`);
await page.fill('input[name="email"]', "maria@example.com");
await page.locator('button[type="submit"]').first().click();
await page.waitForURL(new RegExp(`/clients/${clientId}$`));

// Finish an order paid in full: the receipt goes out by email, with the PDF.
const before = mails().length;
const d = new Date();
d.setDate(d.getDate() + 4);
if (d.getDay() === 0) d.setDate(d.getDate() + 1);
await page.goto(`${BASE}/appointments/new?client=${clientId}&date=${d.toISOString().slice(0, 10)}&time=11:00`);
const select = page.locator('select[name^="svc:"]');
await select.selectOption(await select.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
await page.getByRole("button", { name: "Book appointment" }).click();
await page.waitForURL(/\?booked=1/);
for (const label of ["I'm on the way", "Check in", "Finish order"]) {
  await page.getByRole("button", { name: label }).click();
  await page.waitForLoadState("networkidle");
}
await page.getByRole("button", { name: "$21.80 (20%)" }).click();
await page.getByRole("button", { name: "Venmo" }).click();
await page.getByRole("button", { name: "Charge $130.80" }).click();
await page.getByText("Order finished · Paid in full. Thank you!").waitFor();
// The email goes out right after the payment, without holding up the screen.
await page.getByText(/(Emailed|Sending) to maria@example\.com/).waitFor();
for (let i = 0; i < 20 && !(await page.getByText(/Emailed to maria@example\.com/).count()); i++) {
  await page.waitForTimeout(500);
  await page.reload();
}
await page.getByText(/Emailed to maria@example\.com/).waitFor();
await shot("R01-order-receipt");
// The send-from-phone links: WhatsApp (digits only) and SMS (E.164, "?&body=").
const waHref = await page.getByRole("link", { name: "WhatsApp" }).getAttribute("href");
if (!waHref.startsWith("https://wa.me/1") || !waHref.includes("text=")) fail(`bad WhatsApp link: ${waHref}`);
const smsLink = page.getByRole("link", { name: "Text message" });
const smsHref = await smsLink.getAttribute("href");
if (!/^sms:\+1\d{10}\?&body=/.test(smsHref)) fail(`bad SMS link: ${smsHref}`);
step("the receipt's WhatsApp and text-message links are built by SendFromPhone");
const number = (await page.getByRole("heading", { name: /^Receipt #\d+$/ }).first().textContent()).replace(/\D/g, "");
if (MAIL_DIR) {
  const sent = mails().slice(before).find((m) => m.includes(`(#${number})`));
  if (!sent) fail("the receipt email didn't arrive");
  if (!/To: maria@example\.com/i.test(sent) || !sent.includes("application/pdf") || !sent.includes(`receipt-${number}.pdf`)) {
    fail("the receipt email is missing the client or the PDF");
  }
}
step(`finishing the order emailed receipt #${number} to Maria with the PDF attached`);

// The client's receipt page and PDF.
const receiptHref = await page.getByRole("link", { name: "See the client's receipt page" }).getAttribute("href");
const client = await browser.newPage({ viewport: { width: 390, height: 844 } });
await client.goto(`${BASE}${receiptHref}`);
await client.getByRole("heading", { name: `Receipt #${number}` }).waitFor();
await client.getByText("Paid · Thank you!").waitFor();
await client.getByText("$130.80").first().waitFor();
const pdf = await page.request.get(`${BASE}${receiptHref}/pdf`);
if (pdf.headers()["content-type"] !== "application/pdf" || !(await pdf.body()).subarray(0, 5).toString().startsWith("%PDF")) fail("no PDF");
await client.close();
step("the client's receipt page shows it, and its PDF downloads");

// Email it again.
await page.getByRole("button", { name: "Email again" }).click();
await page.getByText("Receipt emailed.").waitFor();
step("Email again sends it once more");

// The receipt generator.
await page.goto(`${BASE}/receipts/new`);
await page.getByLabel("Search clients").fill("mar");
await page.getByRole("button", { name: "Maria Lopez" }).click();
const add = page.getByLabel("Add a service for Biscuit");
await add.selectOption(await add.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
await page.getByLabel("Price of Bath - Medium (12\"-16\") for Biscuit").fill("100");
await page.locator("select").filter({ has: page.locator('option[value="zelle"]') }).selectOption("zelle");
await page.getByPlaceholder("$0.00").fill("10");
await page.getByText("$110.00").waitFor();
await shot("R02-generator");
await page.getByRole("button", { name: "Make receipt" }).click();
await page.waitForURL(/\/receipts\/[0-9a-f-]+/);
await page.getByText("Receipt emailed.").waitFor();
await page.getByText("Zelle").first().waitFor();
await page.getByText("$110.00").first().waitFor();
await shot("R03-generated");
step("the receipt generator made a paid receipt ($100 + $10 tip, Zelle) and emailed it");

// The receipts list and one PDF with all of them.
await page.goto(`${BASE}/receipts?from=2020-01-01&to=2030-12-31`);
await page.getByText(/receipts? · /).waitFor();
const all = await page.getByRole("link", { name: "Download all (PDF)" }).getAttribute("href");
const res = await page.request.get(`${BASE}${all}`);
const pages = (await PDFDocument.load(await res.body())).getPageCount();
const listed = await page.locator("ul.card li").count();
if (res.headers()["content-type"] !== "application/pdf" || pages !== listed) fail(`all-receipts PDF has ${pages} pages for ${listed} receipts`);
step(`the receipts list downloads all ${listed} receipts as one ${pages}-page PDF`);

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
