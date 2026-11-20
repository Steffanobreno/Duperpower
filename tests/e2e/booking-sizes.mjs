// The size question on the booking page, by breed. Run after slice.mjs.
// A big breed (Goldendoodle) shows "Most Goldendoodles are Large or X-Large." with Large and X-Large
// first and the smaller sizes below, still choosable (minis exist); a "Mini" one and a small breed
// (Maltese) show the four sizes as usual; every client is told the size is checked at the visit.
// Usage: node tests/e2e/booking-sizes.mjs [baseUrl] [screenshotDir]
import { chromium, devices } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const fail = (msg) => {
  throw new Error(msg);
};
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
const button = (name) => page.getByRole("button", { name, exact: true });

await page.goto(`${BASE}/book`);
await page.getByLabel("Mobile phone").fill("9255550198");
await button("Next").tap();
await page.getByLabel("First name").fill("Gia");
await page.getByLabel("Last name").fill("Sizes");
await page.getByLabel("Email").fill("gia.sizes@example.com");
await button("Continue").tap();
await page.getByLabel("Street address").fill("1 Main St");
await page.getByLabel("City").fill("Palo Alto");
await page.getByLabel("ZIP code").fill("94301");
await button("Continue").tap();

const sizeOrder = () => page.getByRole("radiogroup", { name: "Size" }).getByRole("radio").evaluateAll((els) => els.map((e) => e.querySelector("span").textContent.trim()));
const breed = async (name) => {
  await page.getByLabel("Breed").fill("");
  await page.getByLabel("Breed").fill(name);
  await page.waitForTimeout(200);
};

await breed("Goldendoodle");
await page.getByText("Most Goldendoodles are Large or X-Large.").waitFor();
const big = await sizeOrder();
if (big.join(",") !== "Large,X-Large,Small,Medium") fail(`big breed: Large and X-Large should come first: ${big}`);
await page.getByText("Smaller (mini or toy)").waitFor();
await page.getByText("We check the size at the visit and adjust the price if it's different.").waitFor();
if (SHOTS) await page.screenshot({ path: `${SHOTS}/B01-big-breed-sizes.png`, fullPage: true });
// The smaller sizes can still be picked.
await page.getByRole("radio", { name: /^Medium/ }).tap();
if ((await page.getByRole("radio", { name: /^Medium/ }).getAttribute("aria-checked")) !== "true") fail("Medium should still be choosable");
console.log("✓ Goldendoodle: \"Most Goldendoodles are Large or X-Large\", Large and X-Large first, smaller sizes still choosable");

for (const name of ["Mini Goldendoodle", "Maltese"]) {
  await breed(name);
  if (await page.getByText(/are Large or X-Large/).count()) fail(`${name} shouldn't get the big-breed hint`);
  const order = await sizeOrder();
  if (order.join(",") !== "Small,Medium,Large,X-Large") fail(`${name}: the four sizes as usual: ${order}`);
}
console.log("✓ Mini Goldendoodle and Maltese: the four sizes as usual");

await browser.close();
console.log("booking-sizes: all good");
