// Weak or no signal in the van, end to end. Run after slice.mjs (Maria's visit), with
// DATABASE_URL. Today with signal → the service worker saves Today and the day's visits →
// offline: Today and the visit still open (with the "Offline" notice); a screen never opened
// shows the offline page; back online, everything is live again.
// Usage: [OFFLINE_NOTICE=1] node tests/e2e/offline.mjs [baseUrl] [screenshotDir]
import net from "node:net";
import { chromium } from "playwright";
import postgres from "postgres";

// The browser's own "offline" switch doesn't reach the service worker, so the test talks to the
// app through a small relay it can cut, like the signal dropping in the van.
const TARGET = new URL(process.argv[2] ?? "http://localhost:3000");
const sockets = new Set();
let relay;
const signal = (on) => new Promise((done) => {
  if (!on) {
    for (const s of sockets) s.destroy();
    sockets.clear();
    return relay.close(() => done());
  }
  relay = net.createServer((c) => {
    const up = net.connect(Number(TARGET.port || 80), TARGET.hostname);
    sockets.add(c).add(up);
    c.pipe(up).pipe(c);
    const end = () => { c.destroy(); up.destroy(); };
    c.on("error", end).on("close", end);
    up.on("error", end).on("close", end);
  }).listen(3099, "127.0.0.1", () => done());
});
await signal(true);
const BASE = "http://127.0.0.1:3099";
const SHOTS = process.argv[3];
const db = postgres(process.env.DATABASE_URL);
const [{ id, date }] = await db`select id, to_char(start_at at time zone 'America/Los_Angeles', 'YYYY-MM-DD') as date
                                from appointments order by created_at limit 1`;
await db.end();
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 30_000 }).catch(async () => {
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 30_000 });
});
// Open the visit's day (with signal): Today is kept, and its visits are saved in the background.
await page.goto(`${BASE}/today?date=${date}`);
await page.getByText("Maria Lopez").first().waitFor();
const saved = (path) => page.evaluate(async (p) => {
  const cache = await caches.open("woofers-pages-v1");
  return !!(await cache.match(location.origin + p, { ignoreVary: true }));
}, path);
for (let i = 0; i < 40 && !(await saved(`/appointments/${id}`)); i++) await page.waitForTimeout(500);
if (!(await saved(`/appointments/${id}`))) fail("the day's visit should be saved for offline");
if (!(await saved(`/today?date=${date}`))) fail("Today should be saved for offline");
step("with signal: Today and the day's visit are saved on the phone");

await signal(false);
await page.goto(`${BASE}/appointments/${id}`);
await page.getByText("Maria Lopez").first().waitFor();
// The notice needs the app's code saved too, which only a production build does (the dev
// server's files change under the same names, so they're never kept): OFFLINE_NOTICE=1 there.
if (process.env.OFFLINE_NOTICE) await page.getByText(/📴 Offline/).waitFor();
if (SHOTS) await page.screenshot({ path: `${SHOTS}/O01-offline-visit.png` });
await page.goto(`${BASE}/today?date=${date}`);
await page.getByText("Maria Lopez").first().waitFor();
step("offline: the visit and Today still open, with the Offline notice");

await page.goto(`${BASE}/clients?never=opened`);
await page.getByRole("heading", { name: "You're offline" }).waitFor();
step("offline: a screen never opened shows the offline page");

await signal(true);
await page.goto(`${BASE}/appointments/${id}`);
await page.getByText("Maria Lopez").first().waitFor();
if (process.env.OFFLINE_NOTICE && (await page.getByText(/📴 Offline/).count())) fail("back online, the notice should be gone");
step("back online: live again");

await browser.close();
await signal(false);
console.log("All good.");
