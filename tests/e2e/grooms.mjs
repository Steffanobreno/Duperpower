// Grooming history, end to end. Run after slice.mjs (Maria Lopez's finished visit with Biscuit),
// with DATABASE_URL. Note the cut on that visit (blade, style, photo) → a new visit shows "Last
// time" with it and "Same as last time" fills the form → the pet's page lists both cuts.
// Usage: node tests/e2e/grooms.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const db = postgres(process.env.DATABASE_URL);
const [{ first, client, pet }] = await db`
  select a.id as first, a.client_id as client, ap.pet_id as pet from appointments a
  join appointment_pets ap on ap.appointment_id = a.id order by a.created_at limit 1`;
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
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

// A small PNG: 2×2 pixels.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==", "base64");

await page.goto(`${BASE}/appointments/${first}`);
const cut = page.getByRole("form", { name: "Biscuit's cut" });
await cut.getByLabel("Blade / comb").fill("#7F");
await cut.getByLabel("Length / style").fill("Teddy face");
await cut.getByLabel("Note").fill("Short around the eyes");
await cut.getByLabel("Photo of Biscuit's cut").setInputFiles({ name: "cut.png", mimeType: "image/png", buffer: png });
await cut.getByRole("img", { name: "Biscuit after the cut" }).waitFor();
await cut.getByRole("button", { name: "Save cut" }).click();
await cut.getByText("Saved ✓").waitFor();
const [g] = await db`select blade, style, note, photo is not null as photo from pet_grooms where pet_id = ${pet}`;
if (g?.blade !== "#7F" || g.style !== "Teddy face" || !g.photo) fail(`the cut should be saved with its photo: ${JSON.stringify(g)}`);
step("the cut on a visit: blade, style, note and photo are saved");

// The next visit shows the last cut, and "Same as last time" fills the form.
const day = new Date(Date.now() + 20 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
await page.goto(`${BASE}/appointments/new?client=${client}&date=${day}&time=10:00`);
const sel = page.locator('select[name^="svc:"]');
await sel.selectOption(await sel.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
await page.getByLabel(/Send the confirmation/).uncheck();
await page.getByRole("button", { name: "Book appointment" }).click();
await page.waitForURL(/\?booked=1/);
const next = page.getByRole("form", { name: "Biscuit's cut" });
await next.getByText("#7F · Teddy face").waitFor();
await next.getByRole("img", { name: "Biscuit last time" }).waitFor();
await next.getByRole("button", { name: "Same as last time" }).click();
if ((await next.getByLabel("Blade / comb").inputValue()) !== "#7F") fail("“Same as last time” should fill the blade");
await next.getByRole("button", { name: "Save cut" }).click();
await next.getByText("Saved ✓").waitFor();
if (SHOTS) await page.screenshot({ path: `${SHOTS}/G01-cut-last-time.png`, fullPage: true });
step("the next visit shows “Last time” with the photo; “Same as last time” fills it");

await page.goto(`${BASE}/clients/${client}/pets/${pet}`);
await page.getByRole("heading", { name: "Grooming history" }).waitFor();
if ((await page.getByText("#7F · Teddy face").count()) !== 2) fail("the pet page should list both cuts");
step("the pet's page lists every cut, newest first");

await db.end();
await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
