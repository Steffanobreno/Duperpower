// The help center, end to end. Run after slice.mjs, with ADMIN_EMAILS=owner@example.com.
// Menu → Help · topics and articles · an article's steps · the assistant without a key says so ·
// talk to a person · the dashboard's Support page shows the message · the same article in Portuguese.
// Usage: node tests/e2e/help.mjs [baseUrl] [screenshotDir]
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
const shot = (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

await page.getByRole("button", { name: "Open menu" }).first().click();
await page.getByRole("link", { name: "Help", exact: true }).click();
await page.waitForURL(/\/help$/);
for (const topic of ["Getting started", "Booking", "Payments and reports"]) await page.getByText(topic, { exact: true }).first().waitFor();
await page.getByText(/assistant isn't set up yet/).waitFor();
await shot("H01-help");
step("menu → Help: topics, articles, and the assistant says it isn't set up (no key)");

await page.getByRole("link", { name: /Finish an order and take payment/ }).click();
await page.getByRole("heading", { name: "Finish an order and take payment" }).waitFor();
await page.getByText(/Step 2 · Payment/).waitFor();
step("an article shows numbered steps");

await page.goto(`${BASE}/help`);
await page.getByRole("button", { name: /Talk to a person/ }).click();
await page.getByLabel("What do you need help with?").fill("How do I add my second van?");
await page.getByRole("button", { name: "Send", exact: true }).click();
await page.getByText(/We'll answer by email/).waitFor();
await page.goto(`${BASE}/admin/help?f=people`);
await page.getByText("How do I add my second van?").waitFor();
step("talk to a person → it shows on the dashboard's Support page");

// The same article in Portuguese.
await page.goto(`${BASE}/settings/account`);
await page.getByLabel("The app's language").selectOption("pt");
await page.getByRole("button", { name: "Save", exact: true }).nth(1).click();
await page.getByRole("heading", { name: "Idioma" }).waitFor();
await page.goto(`${BASE}/help/checkout`);
await page.getByRole("heading", { name: "Finalizar um pedido e receber" }).waitFor();
await page.goto(`${BASE}/settings/account`);
await page.getByLabel("Idioma do app").selectOption("");
await page.getByRole("button", { name: "Salvar", exact: true }).nth(1).click();
await page.getByRole("heading", { name: "Language" }).waitFor();
step("help articles in Portuguese");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("help: all good");
