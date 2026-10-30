// App lock, end to end. Run after slice.mjs.
// Turn on a PIN → no PIN right after logging in → a new tab asks for it → a wrong PIN is refused →
// the right one opens the app → 5 wrong tries log out → turn it off.
// Usage: node tests/e2e/app-lock.mjs [baseUrl]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const lock = (p) => p.getByRole("dialog", { name: "App locked" });
const login = async (p) => {
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', "owner@example.com");
  await p.fill('input[name="password"]', "correct horse battery");
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/today/);
};

await login(page);
await page.goto(`${BASE}/settings/account`);
await page.getByLabel("PIN (4 to 6 numbers)").fill("2468");
await page.getByLabel("PIN again").fill("2468");
await page.getByRole("button", { name: "Turn on app lock" }).click();
await page.getByText("On. The app asks for your PIN").waitFor();
if (await lock(page).count()) fail("no PIN right after setting it");
step("app lock on; no PIN asked in this session");

// A new tab (a reopened app) asks for the PIN.
const tab = await ctx.newPage();
tab.on("pageerror", (e) => errors.push(e.message));
await tab.goto(`${BASE}/today`);
await lock(tab).waitFor();
await tab.getByLabel("PIN").fill("1111");
await tab.getByRole("button", { name: "OK" }).click();
await tab.getByText(/Wrong PIN/).waitFor();
for (const d of "2468") await tab.getByRole("button", { name: d, exact: true }).click();
await tab.getByRole("button", { name: "OK" }).click();
await lock(tab).waitFor({ state: "detached" });
step("a reopened app asks for the PIN; a wrong one is refused, the right one opens it");

// Five wrong tries log out.
const tab2 = await ctx.newPage();
await tab2.goto(`${BASE}/today`);
await lock(tab2).waitFor();
for (let i = 0; i < 5; i++) {
  await tab2.getByLabel("PIN").fill("0000");
  await tab2.getByRole("button", { name: "OK" }).click();
  // The field empties once the wrong PIN comes back.
  if (i < 4) await tab2.waitForFunction(() => document.querySelector('input[aria-label="PIN"]')?.value === "");
}
await tab2.waitForURL(/\/login/);
step("five wrong PINs log out");

// Log in again (no PIN right after), turn it off.
await login(page);
if (await lock(page).count()) fail("no PIN right after logging in");
await page.goto(`${BASE}/settings/account`);
await page.getByRole("button", { name: "Turn off app lock" }).click();
await page.getByRole("button", { name: "Turn on app lock" }).waitFor();
step("after logging in again, no PIN; app lock turned off");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
