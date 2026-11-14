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
const back = () => page.getByRole("link", { name: "Back" }).or(page.getByRole("button", { name: "Back" })).first().click();

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

// 3. After a save that redirects (edit → client), where Back goes (informational).
await page.getByRole("link", { name: /^Edit/ }).first().click();
await expectPath(`/clients/${client.id}/edit`, "edit again");
await page.locator('form button[type="submit"]').first().click();
await expectPath(`/clients/${client.id}`, "after save");
await back();
await page.waitForTimeout(1500);
const afterSave = path();
// Known limitation (see the task report): a server action's redirect() pushes a history entry, so
// the entry before the saved page is the form itself. Recorded here, not asserted.
step(`after saving the edit form, Back goes to ${afterSave}${afterSave.endsWith("/edit") ? " (the form: redirect() pushes history)" : ""}`);

// 4. A fresh context (no history) opening /requests: Back falls back to /today, inside the app.
const fresh = await browser.newContext({ viewport: { width: 390, height: 800 }, storageState: await context.storageState() });
const p2 = await fresh.newPage();
await p2.goto(`${BASE}/requests`);
await p2.getByRole("link", { name: "Back" }).or(p2.getByRole("button", { name: "Back" })).first().click();
await p2.waitForURL((u) => u.pathname === "/today", { timeout: 8000 });
if (new URL(p2.url()).origin !== new URL(BASE).origin) fail("left the app");
step("direct /requests with no history: Back goes to /today, inside the app");

// 5. Depth stays correct: after going back, a later Back from a deeper screen still works and a fully unwound stack falls back.
await page.goto(`${BASE}/today`);
await page.getByRole("button", { name: "Open menu" }).click();
await page.getByRole("navigation", { name: "Menu" }).getByRole("link", { name: /Booking requests/ }).click();
await expectPath("/requests", "today → requests");
await back();
await expectPath("/today", "back to today");
await page.getByRole("button", { name: "Open menu" }).click();
await page.getByRole("navigation", { name: "Menu" }).getByRole("link", { name: /Waitlist/ }).click();
await expectPath("/waitlist", "today → waitlist");
await back();
await expectPath("/today", "second back goes to today, not further");
step("counter survives back/forward cycles");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("All good.");
