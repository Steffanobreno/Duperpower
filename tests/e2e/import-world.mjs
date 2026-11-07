// Importing clients from any spreadsheet, end to end: a business in Brazil uploads an Excel file
// saved with semicolons and Portuguese column names; a business in the US uploads Google
// Contacts. Phones come out right for each country, names, pets with breeds, city and postal code.
// Needs DATABASE_URL. Usage: node tests/e2e/import-world.mjs [baseUrl]
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = postgres(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/woofers", { max: 1 });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const dir = mkdtempSync(join(tmpdir(), "import-"));

async function business(country, lang, file, text) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: lang === "pt" ? "pt-BR" : "en-US" });
  const page = await ctx.newPage();
  const email = `import-${country.toLowerCase()}-${Date.now()}@example.com`;
  await page.goto(`${BASE}/signup?lang=${lang}`);
  await page.locator('input[name="business"]').fill(`Import ${country}`);
  await page.locator('input[name="name"]').fill("Ana");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("import import 123");
  await page.locator('select[name="country"]').selectOption(country);
  await page.getByRole("checkbox").check();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/welcome/);
  const [{ id }] = await db`select s.business_id as id from staff s join users u on u.id = s.user_id where u.email = ${email}`;
  const path = join(dir, file);
  writeFileSync(path, text);
  await page.goto(`${BASE}/settings/import`);
  await page.setInputFiles('input[type="file"]', path);
  await page.locator('form button[type="submit"]').last().click();
  return { page, id };
}

// Brazil: Excel with semicolons, Portuguese headers, one row without a name.
const br = await business("BR", "pt", "clientes.csv",
  "Nome;Celular;E-mail;Endereço;Cidade;CEP;Nome do pet;Raça;Observações\n" +
  "Mariana Souza;(11) 98765-0141;mari@example.com;Rua Oscar Freire, 900;São Paulo;01426-001;Pipoca;Shih Tzu;Morde se puxar a orelha\n" +
  "Rafael Lima;11 98765-0152;;Av. Rebouças, 1200;São Paulo;05402-100;Thor;Golden Retriever;\n" +
  ";11 1;;;;;;;\n");
await br.page.getByText(/2 clientes e 2 pets importados/).waitFor();
const brClients = await db`select first_name, last_name, phone, city, zip, state from clients where business_id = ${br.id} order by first_name`;
if (brClients.length !== 2) fail(`2 clients expected: ${JSON.stringify(brClients)}`);
const [m] = brClients.filter((c) => c.first_name === "Mariana");
if (m.last_name !== "Souza" || m.phone !== "+5511987650141" || m.zip !== "01426-001" || m.city !== "São Paulo" || m.state) fail(`Mariana: ${JSON.stringify(m)}`);
const [pet] = await db`select p.name, p.breed from pets p join clients c on c.id = p.client_id where c.business_id = ${br.id} and c.first_name = 'Mariana'`;
if (pet?.name !== "Pipoca" || pet.breed !== "Shih Tzu") fail(`Mariana's pet: ${JSON.stringify(pet)}`);
step("Brazil: an Excel file with semicolons and Portuguese columns imports names, +55 phones, pets with breeds, city and CEP");

// US: Google Contacts export (Name, Given Name, Family Name, E-mail 1 - Value, Phone 1 - Value).
const us = await business("US", "en", "contacts.csv",
  "Name,Given Name,Family Name,E-mail 1 - Value,Phone 1 - Value\nEmma Carter,Emma,Carter,emma@example.com,(650) 555-0141\n");
await us.page.getByText(/1 clients and 0 pets imported/).waitFor();
const [emma] = await db`select first_name, last_name, phone, email, state from clients where business_id = ${us.id}`;
if (emma?.phone !== "+16505550141" || emma.last_name !== "Carter" || emma.email !== "emma@example.com" || emma.state) fail(`Emma: ${JSON.stringify(emma)}`);
step("US: a Google Contacts export imports the client with the right phone, and no made-up state");

await db.end();
await browser.close();
console.log("import-world: all good");
