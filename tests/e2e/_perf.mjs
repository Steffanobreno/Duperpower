import { chromium } from "playwright";
import postgres from "postgres";
import { execSync } from "node:child_process";
const db = postgres("postgres://postgres@127.0.0.1:5433/woofers");
const [{ id, client, date }] = await db`select a.id, a.client_id as client, to_char(a.start_at at time zone 'America/Los_Angeles','YYYY-MM-DD') as date from appointments a order by created_at limit 1`;
await db.end();
const B = "http://127.0.0.1:3001";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.goto(`${B}/login`);
await p.fill('input[name="email"]', "owner@example.com");
await p.fill('input[name="password"]', "correct horse battery");
await p.click('button[type="submit"]');
await p.waitForURL(/today/);
const pid = execSync("pgrep -f lagproxy.mjs").toString().trim().split("\n")[0];
const pages = ["/today", `/today?date=${date}`, `/calendar?date=${date}`, `/appointments/${id}`, `/appointments/${id}?rs=${date}`, "/clients", `/clients/${client}`, `/appointments/new?client=${client}&date=${date}`, "/appointments/new", "/requests", "/reports", "/settings", `/appointments/${id}/checkout`];
for (const u of pages) {
  execSync(`kill -USR2 ${pid}`);
  const t = Date.now();
  const r = await ctx.request.get(`${B}${u}`);
  const ms = Date.now() - t;
  await new Promise((r) => setTimeout(r, 150));
  execSync(`kill -USR2 ${pid}`);
  await new Promise((r) => setTimeout(r, 100));
  console.log(String(ms).padStart(5), "ms", r.status(), u);
}
await b.close();
