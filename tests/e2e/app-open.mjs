// Opening the app stays light: in its first 3 seconds, Today asks the server for itself only
// (no burst of prefetches: on serverless hosting each one wakes its own server and queries the
// database, and the groomer's first tap waited behind them). The tabs are fetched ahead later.
// Needs a PRODUCTION build (next build && next start): the dev server never prefetches.
// Run after slice.mjs. Usage: node tests/e2e/app-open.mjs [baseUrl]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:3001";
const fail = (msg) => {
  throw new Error(msg);
};
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
await page.waitForTimeout(6000); // the service worker takes over, as on a phone that used the app before

const seen = [];
ctx.on("request", (r) => {
  const u = new URL(r.url());
  if (u.origin === new URL(BASE).origin && !u.pathname.startsWith("/_next/static") && !u.pathname.startsWith("/favicon")) seen.push({ at: Date.now(), path: u.pathname + u.search });
});
const t0 = Date.now();
await page.goto(`${BASE}/today`);
await page.waitForTimeout(8000);
const early = seen.filter((r) => r.at - t0 < 3000);
if (early.length > 3) fail(`opening Today asked the server ${early.length} times in 3 s:\n${early.map((r) => r.path).join("\n")}`);
console.log(`✓ opening Today: ${early.length} server request(s) in the first 3 s`);
const later = seen.filter((r) => r.at - t0 >= 3000).map((r) => new URL(r.path, BASE).pathname);
if (!later.includes("/calendar")) fail("the tabs should still be fetched ahead, a few seconds later");
console.log("✓ the tabs are fetched ahead a few seconds later");

// A tap shows the progress bar at once, and the screen opens.
await page.locator('a[href^="/clients"]').first().click();
await page.getByRole("progressbar", { name: "Loading" }).waitFor({ timeout: 1000 }).catch(() => {}); // may already be done
await page.waitForURL(/\/clients/);
await page.getByRole("progressbar", { name: "Loading" }).waitFor({ state: "detached" });
console.log("✓ a tap opens the screen and the progress bar goes away");
await browser.close();
console.log("app-open: all good");
