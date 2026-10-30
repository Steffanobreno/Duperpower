// Client pages in other languages, end to end. Run after slice.mjs (Maria Lopez, 650-555-0142,
// Biscuit; one paid visit), with DATABASE_URL set to read the links' tokens.
// The phone's language picks the page's · the menu switches it · a Spanish booking up to the
// times (month and times in Spanish) · the appointment link in Korean · the receipt in Vietnamese.
// Usage: node tests/e2e/languages.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";
import postgres from "postgres";

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
const pageIn = async (locale) => {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale, deviceScaleFactor: 2 })).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
};
const shot = (p, name) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

// The phone's language decides; English stays English.
const en = await pageIn("en-US");
await en.goto(`${BASE}/book`);
await en.getByRole("heading", { name: "Welcome!" }).waitFor();
const es = await pageIn("es-MX");
await es.goto(`${BASE}/book`);
await es.getByRole("heading", { name: "¡Bienvenido!" }).waitFor();
await es.getByLabel("Teléfono celular").waitFor();
step("a Spanish phone gets the booking page in Spanish; an English one in English");

// The menu switches language and keeps it.
await es.getByLabel("Idioma").selectOption("zh");
await es.waitForURL(/lang=zh/);
await es.getByRole("heading", { name: "欢迎！" }).waitFor();
await es.goto(`${BASE}/book`);
await es.getByRole("heading", { name: "欢迎！" }).waitFor();
step("the language menu switches to 中文 and remembers it");

// Maria books in Spanish, up to the times.
const p = await pageIn("en-US");
await p.goto(`${BASE}/book?lang=es`);
await p.getByLabel("Teléfono celular").fill("650-555-0142");
await p.getByRole("button", { name: "Siguiente", exact: true }).click();
await p.getByRole("heading", { name: "¡Qué gusto verte de nuevo, Maria!" }).waitFor();
await p.getByRole("button", { name: "Continuar", exact: true }).click();
await p.getByRole("button", { name: "Continuar al servicio", exact: true }).click();
await p.getByRole("heading", { name: "Elige un servicio" }).waitFor();
await p.getByRole("radiogroup", { name: "Servicio" }).getByRole("radio").first().click();
await p.getByRole("button", { name: "Continuar", exact: true }).click();
await p.getByRole("radio", { name: "No", exact: true }).click();
await p.getByRole("button", { name: "Confirmar la información de Biscuit" }).click();
await p.getByRole("heading", { name: "Elige un horario" }).waitFor();
const month = await p.locator("h3[aria-live]").textContent();
if (!/enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/.test(month)) fail(`month not in Spanish: ${month}`);
await p.getByRole("group", { name: "Horarios disponibles" }).waitFor();
await shot(p, "L01-booking-spanish");
step(`a returning client books in Spanish: steps, month (${month}) and times in Spanish`);

// The appointment link in Korean, the receipt in Vietnamese.
const db = postgres(process.env.DATABASE_URL);
const [visit] = await db`select a.public_token from appointments a join clients c on c.id = a.client_id
                         where c.first_name = 'Maria' order by a.created_at limit 1`;
const [bill] = await db`select public_token from invoices where status = 'closed' order by receipt_no limit 1`;
await db.end();
const ko = await pageIn("en-US");
await ko.goto(`${BASE}/a/${visit.public_token}?lang=ko`);
await ko.getByRole("heading", { name: "Maria님, 안녕하세요!" }).waitFor();
await shot(ko, "L02-appointment-korean");
const vi = await pageIn("en-US");
await vi.goto(`${BASE}/r/${bill.public_token}?lang=vi`);
await vi.getByRole("heading", { name: /^Biên nhận #\d+$/ }).waitFor();
await vi.getByText("Đã thanh toán · Cảm ơn bạn!").waitFor();
await shot(vi, "L03-receipt-vietnamese");
step("the appointment link reads in Korean and the receipt in Vietnamese");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
