// The header's back arrow returns to the previous screen of the app, and falls back to the old
// fixed page (and stays inside the app) when there is no history. Run after slice.mjs, with DATABASE_URL.
// Usage: node tests/e2e/back.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = postgres(process.env.DATABASE_URL, { max: 1 });
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const [client] = await db`select id from clients order by created_at limit 1`;
await db.end();

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const path = () => new URL(page.url()).pathname;
const expectPath = async (want, what) => {
  await page.waitForURL((u) => u.pathname === want, { timeout: 8000 }).catch(() => fail(`${what}: expected ${want}, at ${path()}`));
};
const back = () => page.getByRole("link", { name: "Back", exact: true }).or(page.getByRole("button", { name: "Back", exact: true })).first().click();

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

// 1. Settings → menu → Booking requests → Back lands on Settings (not Today).
await page.goto(`${BASE}/settings`);
await page.getByRole("button", { name: "Open menu" }).click();
await page.getByRole("navigation", { name: "Menu" }).getByRole("link", { name: /Booking requests/ }).click();
await expectPath("/requests", "menu → requests");
await back();
await expectPath("/settings", "Back from requests");
step("Settings → Booking requests → Back returns to Settings");

// 2. Client list → client → edit → Back returns to the client.
await page.goto(`${BASE}/clients`);
await page.getByRole("link", { name: /Lopez/ }).first().click();
await expectPath(`/clients/${client.id}`, "open client from list");
await page.getByRole("link", { name: /^Edit/ }).first().click();
await expectPath(`/clients/${client.id}/edit`, "open edit");
await back();
await expectPath(`/clients/${client.id}`, "Back from edit");
step("Client → Edit → Back returns to the client");

// 3. After a save that redirects (edit → client, a replace), ONE Back reaches the list: the save left
// the client page twice in a row in history (before and instead of the form), and Back skips the copy.
await page.goto(`${BASE}/clients`);
await page.getByRole("link", { name: /Lopez/ }).first().click();
await expectPath(`/clients/${client.id}`, "client from list");
await page.getByRole("link", { name: /^Edit/ }).first().click();
await expectPath(`/clients/${client.id}/edit`, "edit again");
await page.locator('form button[type="submit"]').first().click();
await expectPath(`/clients/${client.id}`, "after save");
await back();
await expectPath("/clients", "one Back after save reaches the list");
await page.waitForTimeout(800);
if (path() !== "/clients") fail(`Back after save should stay on the list, at ${path()}`);
step("Client → Edit → Save → one Back reaches the list (never the form, never the same client page)");

// 4. A fresh context (no history) opening /requests: Back falls back to /today, inside the app.
const fresh = await browser.newContext({ viewport: { width: 390, height: 800 }, storageState: await context.storageState() });
const p2 = await fresh.newPage();
await p2.goto(`${BASE}/requests`);
await p2.getByRole("link", { name: "Back", exact: true }).or(p2.getByRole("button", { name: "Back", exact: true })).first().click();
await p2.waitForURL((u) => u.pathname === "/today", { timeout: 8000 });
if (new URL(p2.url()).origin !== new URL(BASE).origin) fail("left the app");
step("direct /requests with no history: Back goes to /today, inside the app");

// 5. A browser back gesture, then the Back button: the counter stays right.
const toClient = async () => {
  await page.goto(`${BASE}/clients`);
  await page.getByRole("link", { name: /Lopez/ }).first().click();
  await expectPath(`/clients/${client.id}`, "client from list");
};
await toClient();
await page.getByRole("link", { name: /^Edit/ }).first().click();
await expectPath(`/clients/${client.id}/edit`, "edit");
await page.goBack(); // gesture: edit → client
await expectPath(`/clients/${client.id}`, "gesture back");
await back();
await expectPath("/clients", "Back after a gesture");
step("browser back gesture, then the Back button");

// 6. Forward is a real step: back, forward, then Back again.
await page.getByRole("link", { name: /Lopez/ }).first().click();
await expectPath(`/clients/${client.id}`, "client again");
await page.goBack();
await expectPath("/clients", "gesture back to the list");
await page.goForward();
await expectPath(`/clients/${client.id}`, "forward");
await back();
await expectPath("/clients", "Back after forward");
step("back, forward, Back");

// 7. A reload mid-session keeps the history: Back still returns to the previous in-app screen.
await page.getByRole("link", { name: /Lopez/ }).first().click();
await expectPath(`/clients/${client.id}`, "client for reload");
await page.reload();
await expectPath(`/clients/${client.id}`, "reload");
await back();
await expectPath("/clients", "Back after reload");
step("reload mid-session, Back returns to the previous screen");

// 8. A query-only change (same pathname) followed by Back.
await page.getByRole("link", { name: /Lopez/ }).first().click();
await expectPath(`/clients/${client.id}`, "client for query step");
await page.evaluate(() => window.history.pushState({}, "", `${location.pathname}?x=1`));
await back(); // undoes the query-only entry: same pathname
await page.waitForFunction(() => !location.search);
await expectPath(`/clients/${client.id}`, "Back over a query-only entry");
await back();
await expectPath("/clients", "Back past the query-only entry");
step("query-only change then Back, then Back again");

// 9. The Back button, then the browser's Forward, then Back again: the position follows Forward.
await page.goto(`${BASE}/settings`);
await page.getByRole("button", { name: "Open menu" }).click();
await page.getByRole("navigation", { name: "Menu" }).getByRole("link", { name: /Booking requests/ }).click();
await expectPath("/requests", "menu → requests (forward test)");
await back();
await expectPath("/settings", "Back to settings");
await page.goForward();
await expectPath("/requests", "forward to requests");
await back();
await expectPath("/settings", "Back after Forward returns to Settings (not the /today fallback)");
step("Back button, Forward, Back again returns to the same previous screen");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("All good.");
