// Online booking settings, end to end. Run after slice.mjs (Maria Lopez, 650-555-0142, Biscuit),
// with DATABASE_URL set.
// QR code poster and image · automation "book clients I know right away": Maria books online and
// is booked (not a request) · the new client form adds a client and two pets, and is translated.
// Usage: node tests/e2e/online-booking-settings.mjs [baseUrl] [screenshotDir]
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

const page = await newPage();
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

// QR code.
await page.goto(`${BASE}/settings/booking`);
await page.locator("#qr-poster svg").waitFor();
await page.getByRole("img", { name: /QR code for .*\/book/ }).waitFor();
const png = await page.request.get(`${BASE}/settings/booking/qr`);
if (png.headers()["content-type"] !== "image/png" || (await png.body()).length < 1000) fail("QR image missing");
const download = await page.request.get(`${BASE}/settings/booking/qr?download`);
if (!/attachment/.test(download.headers()["content-disposition"] ?? "")) fail("Save image should download");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/B01-booking-settings.png`, fullPage: true });
step("QR code poster on the page; PNG to share or save");

// Automation: clients already on file are booked right away.
await page.getByText("Book clients I already know right away").click();
await page.locator("form", { hasText: "When a client books online" }).getByRole("button", { name: "Save" }).click();
await page.getByText("Saved.").first().waitFor();

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
await client.locator("button[aria-label*='open time']:not([disabled])").last().click();
await client.getByRole("group", { name: "Open times" }).locator("button").first().click();
await client.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
if (await client.getByRole("button", { name: /Read and sign/ }).count()) {
  await client.getByRole("button", { name: /Read and sign/ }).click();
  await client.getByLabel("I have read and agree to the service agreement.").check();
  await client.getByLabel("Type your full name to sign").fill("Maria Lopez");
  const pad = client.getByLabel("Draw your signature here");
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  await client.mouse.move(box.x + 30, box.y + 60);
  await client.mouse.down();
  await client.mouse.move(box.x + 160, box.y + 30, { steps: 8 });
  await client.mouse.up();
  await button("Sign agreement").click();
}
await button("Submit booking request").click();
await client.getByRole("heading", { name: /You're booked/ }).waitFor();
await client.getByText("See you then!").waitFor();
const [online] = await db`select a.status from appointments a join clients c on c.id = a.client_id
                          where c.first_name = 'Maria' and a.source = 'online' order by a.created_at desc limit 1`;
if (online?.status !== "unconfirmed") fail(`online booking should be booked, is ${online?.status}`);
if (SHOTS) await client.screenshot({ path: `${SHOTS}/B02-booked-right-away.png`, fullPage: true });
step("a client on file books online and is booked right away (“You're booked”)");

// The new client form, in Spanish.
const form = await newPage("es-MX");
await form.goto(`${BASE}/intake`);
await form.getByRole("heading", { name: "Formulario para nuevos clientes" }).waitFor();
await form.getByLabel("Nombre", { exact: true }).fill("Rosa");
await form.getByLabel("Apellido").fill("Diaz");
await form.getByLabel("Teléfono celular").fill("650-555-0199");
await form.getByLabel("Correo electrónico").fill("rosa@example.com");
await form.getByLabel("Nombre de la mascota").fill("Coco");
await form.getByLabel("Raza").fill("Poodle");
await form.getByLabel("Tamaño").selectOption("small");
await form.getByRole("button", { name: /Agregar otra mascota/ }).click();
await form.getByLabel("Nombre de la mascota").nth(1).fill("Max");
if (SHOTS) await form.screenshot({ path: `${SHOTS}/B03-intake-spanish.png`, fullPage: true });
await form.getByRole("button", { name: "Enviar" }).click();
await form.getByRole("heading", { name: /Recibimos tu información/ }).waitFor();
const pets = await db`select p.name, p.breed, p.size_class from pets p join clients c on c.id = p.client_id
                      where c.phone = '+16505550199' order by p.name`;
if (pets.map((p) => p.name).join() !== "Coco,Max" || pets[0].size_class !== "small") fail(`pets not saved: ${JSON.stringify(pets)}`);
await page.goto(`${BASE}/clients?q=Rosa`);
await page.getByRole("link", { name: /Rosa Diaz/ }).waitFor();
step("the new client form (in Spanish) adds Rosa with Coco and Max");

await db.end();
await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
