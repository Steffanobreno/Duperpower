// Accessibility (WCAG 2.2 AA, axe-core) on every kind of screen: the public site, the client's
// pages (booking, new-client form, their visit, their receipt, the report card) and the groomer's app; and no
// sideways scroll on the smallest phones (320 px).
// Run after slice.mjs (owner@example.com, Maria Lopez's visit and receipt). Needs DATABASE_URL.
// Usage: node tests/e2e/a11y.mjs [baseUrl]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const axe = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const db = postgres(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/woofers", { max: 1 });
const [visit] = await db`select id, public_token from appointments order by created_at limit 1`;
const [bill] = await db`select public_token from invoices where public_token is not null limit 1`;
const [client] = await db`select id from clients order by created_at limit 1`;
// The first visit's report card (the token is made once and kept, as when the groomer sends it).
const [card] = visit ? await db`update appointments set report_token = coalesce(report_token, md5(random()::text))
  where id = ${visit.id} returning report_token` : [];
// Fill the gap on a day a week ahead, in the business's time zone.
const [{ fillDay }] = await db`select to_char((now() at time zone timezone)::date + 7, 'YYYY-MM-DD') as "fillDay"
  from businesses where booking_slug = 'woofers'`;
await db.end();

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const problems = [];
async function check(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  // Closed questions and menus are checked open too.
  for (const d of await page.locator("details").all()) await d.evaluate((e) => (e.open = true)).catch(() => {});
  await page.addScriptTag({ content: axe });
  const found = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }))
    .violations.map((v) => `${v.id} ×${v.nodes.length} (${v.nodes[0].target.join(" ")})`));
  if (found.length) problems.push(`${path}: ${found.join("; ")}`);
}

for (const width of [390, 1280]) {
  const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
  // The public site and the client's pages.
  for (const path of ["/?lang=en", "/features", "/pricing?lang=pt", "/mobile-grooming-software?lang=es", "/mobile-grooming-route-planner",
    "/switch", "/guides", "/guides/checkout", "/terms", "/privacy", "/signup", "/login", "/login/forgot", "/no-such-page",
    "/book/woofers", "/intake", visit && `/a/${visit.public_token}`, bill && `/r/${bill.public_token}`, card && `/g/${card.report_token}`].filter(Boolean)) {
    await check(page, path);
  }
  // The groomer's app.
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', "owner@example.com");
  await page.fill('input[name="password"]', "correct horse battery");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/today/);
  for (const path of ["/today", "/today?view=list", "/calendar", "/clients", `/clients/${client.id}`, `/appointments/${visit.id}`,
    `/appointments/${visit.id}/checkout`, "/appointments/new", "/reports", "/settings", "/settings/business", "/settings/services",
    "/settings/booking", "/settings/messages", "/settings/team", "/help", "/billing", "/marketing", "/waitlist", "/requests", `/fill/${fillDay}`]) {
    await check(page, path);
  }
  console.log(`✓ ${width}px: every screen checked`);
  await page.context().close();
}
// The smallest phones (320 px): no screen may scroll sideways.
{
  const page = await (await browser.newContext({ viewport: { width: 320, height: 640 } })).newPage();
  const wide = async (path) => {
    await page.goto(`${BASE}${path}`, { waitUntil: "load" });
    await page.waitForTimeout(300);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    if (w > 320) problems.push(`${path}: ${w}px wide on a 320px phone`);
  };
  for (const path of ["/?lang=pt", "/features", "/pricing", "/signup", "/book/woofers", "/intake", visit && `/a/${visit.public_token}`, card && `/g/${card.report_token}`].filter(Boolean)) await wide(path);
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', "owner@example.com");
  await page.fill('input[name="password"]', "correct horse battery");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/today/);
  for (const path of ["/today", "/calendar", "/clients", `/clients/${client.id}`, `/appointments/${visit.id}`, `/appointments/${visit.id}/checkout`,
    "/appointments/new", "/reports", "/settings", "/settings/hours", "/settings/business", "/settings/booking", "/billing", `/fill/${fillDay}`]) await wide(path);
  console.log("✓ 320px: no screen scrolls sideways");
}

await browser.close();
if (problems.length) throw new Error(`accessibility problems:\n${problems.join("\n")}`);
console.log("a11y: all good (WCAG 2.2 AA, axe-core)");
