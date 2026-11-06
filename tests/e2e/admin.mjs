// The app owner's dashboard, end to end. Run after slice.mjs, with ADMIN_EMAILS=owner@example.com
// on the server. Overview numbers · business list and search · one business: extend the trial,
// make it a courtesy account · someone else (a new signup) can't open it.
// Usage: node tests/e2e/admin.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const newPage = async (width = 390) => {
  const p = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
};
const shot = (p, name) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

// A new groomer signs up from an Instagram link: the dashboard shows where they came from.
const visitor = await newPage();
await visitor.goto(`${BASE}/signup?utm_source=instagram`);
await visitor.getByLabel("Business name").fill("Bubbles Dog Spa");
await visitor.getByLabel("Your name").fill("Maya");
await visitor.getByLabel("Email").fill(`maya${Date.now()}@example.com`);
await visitor.getByLabel("Password").fill("bubbles bubbles 1");
await visitor.getByRole("checkbox").check();
await visitor.getByRole("button", { name: "Create my account" }).click();
await visitor.waitForURL(/\/today/);
const denied = await visitor.goto(`${BASE}/admin`);
if (denied?.status() !== 404) fail(`a groomer should not open /admin (got ${denied?.status()})`);
step("a new signup can't open the dashboard (404)");

const page = await newPage(1100);
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
await page.goto(`${BASE}/admin`);
await page.getByRole("heading", { name: "Visão geral" }).waitFor();
for (const label of ["Receita mensal (MRR)", "Pagando", "Negócios no total", "Novos hoje", "Em teste grátis", "Em risco", "Cadastros por semana"]) {
  await page.getByText(label, { exact: true }).first().waitFor();
}
await page.getByText("instagram").first().waitFor();
const trials = await page.getByText("Em teste grátis", { exact: true }).locator("xpath=..").innerText();
if (!/\n1\b|\n[1-9]/.test(trials)) fail(`the new signup should count as a free trial: ${trials}`);
await shot(page, "A01-admin-overview");
step("overview: revenue, signups, trials, risk, weekly chart and where signups came from (instagram)");

await page.getByRole("link", { name: "Negócios", exact: true }).click();
await page.getByLabel("Buscar").fill("bubbles");
await page.getByRole("button", { name: "Buscar" }).click();
await page.getByRole("link", { name: /Bubbles Dog Spa/ }).click();
await page.getByRole("heading", { name: "Bubbles Dog Spa" }).waitFor();
await page.getByText("Teste grátis", { exact: true }).first().waitFor();
await page.getByText("instagram").first().waitFor();
await page.getByLabel("Mudar para").selectOption("free");
await page.getByRole("button", { name: "Salvar" }).click();
await page.getByText("Cortesia", { exact: true }).first().waitFor();
await page.getByRole("button", { name: "Dar" }).click();
await page.getByText("Teste grátis", { exact: true }).first().waitFor();
await shot(page, "A02-admin-business");
step("one business: plan changed to courtesy, then 14 more trial days");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("admin: all good");
