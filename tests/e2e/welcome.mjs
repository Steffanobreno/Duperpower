// The first-run setup after signup, end to end, in Portuguese from Brazil. Run after slice.mjs.
// Signup (phone in Portuguese, São Paulo) → 5 steps: business, prices (starter services named in
// Portuguese and in cm), hours, clients, booking link → Today. Needs DATABASE_URL.
// Usage: node tests/e2e/welcome.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const db = postgres(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/woofers", { max: 1 });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const page = await (await browser.newContext({
  viewport: { width: 390, height: 844 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo",
  extraHTTPHeaders: { "accept-language": "pt-BR,pt;q=0.9" },
})).newPage();
page.on("pageerror", (e) => errors.push(e.message));
const shot = (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

const email = `bia${Date.now()}@example.com`;
await page.goto(`${BASE}/signup`);
await page.getByLabel("Nome do negócio").fill("Banho da Bia");
await page.getByLabel("Seu nome").fill("Bia");
await page.getByLabel("E-mail").fill(email);
await page.getByLabel("Senha").fill("banho banho 123");
if ((await page.getByLabel("País").inputValue()) !== "BR") fail("Brazil should be suggested from the phone's time zone");
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: "Criar minha conta" }).click();
await page.waitForURL(/\/welcome/);
await page.getByText("Passo 1 de 5").first().waitFor();
await shot("W10-welcome-1");
step("signup in Portuguese from Brazil opens the setup (step 1 of 5)");

// 1. Business: phone and address.
await page.getByLabel("Telefone do negócio").fill("(11) 91234-5678");
await page.getByLabel("Cidade").fill("São Paulo");
await page.getByRole("button", { name: "Continuar" }).click();
await page.waitForURL(/step=2/);

// 2. Prices: the starter services are in Portuguese, sizes in cm; change one price, drop an add-on.
await page.getByText("Tosa completa - Pequeno (30 cm ou menos)", { exact: true }).waitFor();
await page.getByText("Remoção de cheiro de gambá", { exact: true }).waitFor();
await page.getByLabel("Preço de Tosa completa - Pequeno (30 cm ou menos)").fill("90");
await page.getByLabel("Oferecer Pintura de unhas").uncheck();
await shot("W11-welcome-prices");
await page.getByRole("button", { name: "Continuar" }).click();
await page.waitForURL(/step=3/);
const [svc] = await db`select s.price_cents from services s join businesses b on b.id = s.business_id
  join staff st on st.business_id = b.id join users u on u.id = st.user_id
  where u.email = ${email} and s.name = 'Tosa completa - Pequeno (30 cm ou menos)'`;
if (svc?.price_cents !== 9000) fail(`the price should be R$ 90 (9000), got ${svc?.price_cents}`);
const [{ off }] = await db`select count(*)::int as off from services s join staff st on st.business_id = s.business_id
  join users u on u.id = st.user_id where u.email = ${email} and s.name = 'Pintura de unhas' and not s.active`;
if (off !== 1) fail("the unchecked add-on should be switched off");
step("prices: starter services in Portuguese and cm; R$ 90 saved, an add-on switched off");

// 3. Hours, 4. clients (later), 5. booking link and finish.
await page.getByRole("button", { name: "Continuar" }).click();
await page.waitForURL(/step=4/);
await page.getByRole("link", { name: /Importar de outro app/ }).waitFor();
await page.getByRole("link", { name: "Faço depois" }).click();
await page.waitForURL(/step=5/);
await page.locator(`[value*="/book/banho-da-bia"]`).first().waitFor();
await shot("W12-welcome-share");
await page.getByRole("button", { name: /Concluir|Finalizar/ }).click();
await page.waitForURL(/\/today/);
const [{ done }] = await db`select b.onboarded_at is not null as done from businesses b join staff st on st.business_id = b.id
  join users u on u.id = st.user_id where u.email = ${email}`;
if (!done) fail("finishing should mark the setup as done");
step("hours → clients later → booking link → Today; setup marked done");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await db.end();
await browser.close();
console.log("welcome: all good");
