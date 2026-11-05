// Client and pet options, end to end. Run after slice.mjs (Maria Lopez, Biscuit, a visit).
// Lists start with defaults · add, rename, move and remove items · pet codes with colors ·
// tags and referral on the client · coat, spayed and behavior on the pet · codes on the pet,
// its visit and Today · filter clients by tag.
// Usage: VISIT_DATE=yyyy-mm-dd node tests/e2e/client-options.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const shot = (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

// The lists start with defaults.
await page.goto(`${BASE}/settings/lists`);
await page.getByRole("link", { name: /Client tags.*VIP/ }).waitFor();
await page.getByRole("link", { name: /Coat types.*Double/ }).waitFor();
await page.getByRole("link", { name: /Pet codes.*Matted/ }).waitFor();
await shot("O01-lists");
step("client and pet lists start with defaults");

// Client tags: add, rename, move, remove.
await page.getByRole("link", { name: /Client tags/ }).click();
await page.getByLabel("New item").fill("Loves treats");
await page.getByRole("button", { name: "Add", exact: true }).click();
await page.getByRole("button", { name: "Rename Loves treats" }).waitFor();
await page.getByLabel("New item").fill("VIP");
await page.getByRole("button", { name: "Add", exact: true }).click();
await page.getByText("“VIP” is already on the list.").waitFor();
await page.getByRole("button", { name: "OK" }).click();
await page.getByRole("button", { name: "Rename Loves treats" }).click();
await page.getByLabel("New name for Loves treats").fill("Treat lover");
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.getByRole("button", { name: "Rename Treat lover" }).waitFor();
await page.getByRole("button", { name: "Move Treat lover up" }).click();
await page.waitForFunction(() => {
  const names = [...document.querySelectorAll('button[aria-label^="Rename"]')].map((b) => b.textContent);
  return names.at(-2) === "Treat lover";
});
await page.getByRole("button", { name: "Remove Pays late" }).click();
await page.getByRole("button", { name: "Rename Pays late" }).waitFor({ state: "detached" });
await shot("O02-tags");
step("tags: add, duplicate refused, rename, move up, remove");

// Pet codes: add one with a color.
await page.goto(`${BASE}/settings/lists/pet-codes`);
await page.getByLabel("Code (up to 8 letters)").fill("#7 blade");
await page.getByLabel("What it means (optional)").fill("Body with a #7 blade");
await page.getByLabel("#0891b2").check({ force: true });
await page.getByRole("button", { name: "Add code" }).click();
await page.getByText("Code added.").waitFor();
await page.getByRole("button", { name: "Edit #7 blade" }).waitFor();
await shot("O03-pet-codes");
step("a new pet code with its color");

// The client: tags and referral.
await page.goto(`${BASE}/clients?q=Maria`);
await page.getByRole("link", { name: /Maria/ }).first().click();
await page.waitForURL(/\/clients\/[0-9a-f-]+$/);
const clientUrl = page.url();
await page.goto(`${clientUrl}/edit`);
await page.getByLabel("How they found you").selectOption("Instagram");
await page.getByText("VIP", { exact: true }).click();
await page.getByText("Treat lover", { exact: true }).click();
await page.getByRole("button", { name: "Save changes" }).click();
await page.waitForURL(clientUrl);
await page.getByText("Instagram").waitFor();
await page.locator("dd", { hasText: "VIP" }).getByText("Treat lover").waitFor();
step("client: referral source and two tags");

// The pet: coat, spayed, behavior, codes.
await page.locator(`a[href*="/pets/"]`).filter({ hasNotText: "Add pet" }).first().click();
await page.waitForURL(/\/pets\/[0-9a-f-]+$/);
await page.getByLabel("Coat").selectOption("Curly");
await page.getByLabel("Spayed / neutered").selectOption("yes");
await page.getByText("Shy", { exact: true }).click();
await page.getByRole("button", { name: "Save pet" }).click();
await page.waitForURL(clientUrl);
await page.locator(`a[href*="/pets/"]`).filter({ hasNotText: "Add pet" }).first().click();
await page.waitForURL(/\/pets\/[0-9a-f-]+$/);
if ((await page.getByLabel("Coat").inputValue()) !== "Curly") fail("coat not saved");
if ((await page.getByLabel("Spayed / neutered").inputValue()) !== "yes") fail("spayed not saved");
await page.getByText("Matted", { exact: true }).click();
await page.getByText("#7 blade", { exact: true }).click();
await page.getByRole("button", { name: "Save codes" }).click();
await page.waitForLoadState("networkidle");
await shot("O04-pet");
await page.goto(clientUrl);
await page.locator("li", { hasText: "Biscuit" }).getByText("Matted").waitFor();
await page.locator("li", { hasText: "Biscuit" }).getByText("Shy").waitFor();
step("pet: coat, spayed, behavior tag and two codes, shown on the client");

// Codes on the visit and Today; client tags on the visit.
await page.goto(`${BASE}/today${process.env.VISIT_DATE ? `?date=${process.env.VISIT_DATE}` : ""}`);
await page.getByText("#7 blade").first().waitFor();
await page.locator('a[href^="/appointments/"]:not([href*="new"])').first().click();
await page.waitForURL(/\/appointments\/[0-9a-f-]+$/);
await page.getByText("Matted").first().waitFor();
await page.getByText("Treat lover").waitFor();
step("pet codes on Today and the visit; client tags on the visit");

// Renaming a tag follows the client; the client list filters by tag.
await page.goto(`${BASE}/settings/lists/client_tag`);
await page.getByRole("button", { name: "Rename Treat lover" }).click();
await page.getByLabel("New name for Treat lover").fill("Treats!");
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.getByRole("button", { name: "Rename Treats!" }).waitFor();
await page.goto(`${BASE}/clients`);
await page.getByRole("link", { name: "Treats!", exact: true }).click();
await page.waitForURL(/tag=Treats/);
await page.getByRole("link", { name: /Maria/ }).waitFor();
await page.getByText("1 found").waitFor();
await page.getByRole("link", { name: "Great tipper", exact: true }).click();
await page.getByText("No client matches that search").waitFor();
await shot("O05-filter");
step("renaming a tag updates the client; the client list filters by tag");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
