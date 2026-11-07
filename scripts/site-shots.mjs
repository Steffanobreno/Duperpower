// Screenshots of the real app for the site's Portuguese and Spanish pages: a demo business in
// Brazil (São Paulo, reais) and one in Mexico (Mexico City, pesos) with a realistic day.
// Test database only. Run with the dev server started with the fake Google (drive times).
// Usage (test database only, dev server started with the fake Google for drive times):
//   DATABASE_URL=... [LANGS=pt,es] node scripts/site-shots.mjs public/landing
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import postgres from "postgres";

const B = "http://127.0.0.1:3000";
const OUT = process.argv[2];
const db = postgres(process.env.DATABASE_URL, { max: 1 });

const SPECS = [
  {
    lang: "pt", locale: "pt-BR", country: "BR", tz: "America/Sao_Paulo", factor: 1, round: 1,
    business: "Banho e Tosa Móvel da Ana", owner: "Ana", phone: "(11) 98765-4300", zip: "01310-100",
    rows: [
      ["Mariana", "Souza", "+5511987650141", "Pipoca", "Shih Tzu", "small", "cut", "08:00", "confirmed", "Rua Oscar Freire, 900", "São Paulo", "01426-001", -23.5636, -46.6713],
      ["Rafael", "Lima", "+5511987650152", "Thor", "Golden Retriever", "large", "bath", "10:30", "en_route", "Av. Rebouças, 1200", "São Paulo", "05402-100", -23.5662, -46.6795],
      ["Juliana", "Costa", "+5511987650163", "Mel", "Lhasa Apso", "small", "cut", "13:00", "confirmed", "Rua Harmonia, 400", "São Paulo", "05435-000", -23.5530, -46.6890],
      ["Pedro", "Alves", "+5511987650174", "Bento", "Bernese", "xlarge", "cut", "15:30", "unconfirmed", "Rua Pamplona, 1500", "São Paulo", "01405-001", -23.5689, -46.6584],
    ],
  },
  {
    lang: "es", locale: "es-MX", country: "MX", tz: "America/Mexico_City", factor: 4, round: 5000,
    business: "Estética Canina Móvil Luna", owner: "Valeria", phone: "55 1234 5600", zip: "06700",
    rows: [
      ["Valeria", "Hernández", "+525512345601", "Canela", "Maltés", "small", "cut", "08:00", "confirmed", "Av. Álvaro Obregón 120", "Ciudad de México", "06700", 19.4180, -99.1610],
      ["Diego", "Martínez", "+525512345602", "Rocky", "Labrador", "large", "bath", "10:30", "en_route", "Calle Durango 250", "Ciudad de México", "06700", 19.4200, -99.1660],
      ["Sofía", "Ramírez", "+525512345603", "Luna", "Schnauzer", "small", "cut", "13:00", "confirmed", "Av. Ámsterdam 80", "Ciudad de México", "06100", 19.4120, -99.1700],
      ["Andrés", "López", "+525512345604", "Max", "Husky", "xlarge", "cut", "15:30", "unconfirmed", "Av. Michoacán 60", "Ciudad de México", "06140", 19.4110, -99.1720],
    ],
  },
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const s of SPECS.filter((x) => !process.env.LANGS || process.env.LANGS.split(",").includes(x.lang))) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: s.locale, timezoneId: s.tz,
    extraHTTPHeaders: { "Accept-Language": s.locale },
  });
  const page = await ctx.newPage();
  const email = `demo-${s.lang}-${Date.now()}@example.com`;
  await page.goto(`${B}/signup?lang=${s.lang}`);
  await page.locator('input[name="business"]').fill(s.business);
  await page.locator('input[name="name"]').fill(s.owner);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("demo demo demo 123");
  await page.locator('select[name="country"]').selectOption(s.country);
  await page.locator('input[name="phone"]').fill(s.phone);
  await page.locator('input[name="zip"]').fill(s.zip);
  await page.getByRole("checkbox").check();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/welcome/);
  const [{ id: biz }] = await db`select s.business_id as id from staff s join users u on u.id = s.user_id where u.email = ${email}`;
  // Prices that make sense in the local currency; setup done; today's realistic day.
  await db`update services set price_cents = round(price_cents * ${s.factor} / ${s.round}::numeric) * ${s.round} where business_id = ${biz}`;
  await db`update businesses set onboarded_at = now(), timezone = ${s.tz} where id = ${biz}`;
  await db`update staff set language = ${s.lang} where business_id = ${biz}`;
  const [{ staff }] = await db`select id as staff from staff where business_id = ${biz} and role = 'owner'`;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: s.tz }).format(new Date());
  const ids = [];
  for (const [first, last, phone, pet, breed, size, kind, time, status, street, city, zip, lat, lng] of s.rows) {
    const [c] = await db`insert into clients (business_id, first_name, last_name, phone, address_line, city, state, zip, lat, lng, sms_consent_at, source)
      values (${biz}, ${first}, ${last}, ${phone}, ${street}, ${city}, null, ${zip}, ${lat}, ${lng}, now(), 'manual') returning id`;
    const [p] = await db`insert into pets (client_id, name, breed, size_class) values (${c.id}, ${pet}, ${breed}, ${size}) returning id`;
    const [svc] = await db`select id, name, price_cents, duration_min from services where business_id = ${biz} and kind = 'service'
      and size_class = ${size} and (sort_order < 4) = ${kind === "cut"} order by sort_order limit 1`;
    const start = `${today} ${time}`;
    const [a] = await db`insert into appointments (business_id, client_id, staff_id, start_at, end_at, status, address_line, zip, lat, lng)
      values (${biz}, ${c.id}, ${staff}, (${start}::timestamp at time zone ${s.tz}), (${start}::timestamp at time zone ${s.tz}) + make_interval(mins => greatest(${svc.duration_min}::int, 90)),
              ${status}, ${`${street}, ${city}`}, ${zip}, ${lat}, ${lng}) returning id`;
    const [ap] = await db`insert into appointment_pets (appointment_id, pet_id) values (${a.id}, ${p.id}) returning id`;
    await db`insert into appointment_services (appointment_pet_id, service_id, name, price_cents, duration_min)
             values (${ap.id}, ${svc.id}, ${svc.name}, ${svc.price_cents}, ${svc.duration_min})`;
    ids.push(a.id);
  }
  const [{ slug }] = await db`select booking_slug as slug from businesses where id = ${biz}`;
  const dir = `${OUT}/${s.lang}`;
  mkdirSync(dir, { recursive: true });
  // The dev server's "N" badge isn't part of the app: hidden in the pictures.
  const hideDev = (p) => p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  const shoot = async (name) => { await hideDev(page); await page.waitForTimeout(700); await page.screenshot({ path: `${dir}/${name}.png` }); };

  await page.goto(`${B}/today?view=list`);
  await page.getByText(/min/).first().waitFor({ timeout: 15000 }).catch(() => console.log(s.lang, "no drive times shown"));
  // Start the picture at "Open the whole route in Google Maps" and the stops (the map tiles can't load here).
  await page.evaluate(() => {
    const a = document.querySelector('a[href*="google.com/maps/dir"]');
    if (a) window.scrollTo(0, a.getBoundingClientRect().top + window.scrollY - 72);
  });
  await shoot("today");

  await page.goto(`${B}/appointments/${ids[0]}`);
  await shoot("visit");

  await page.goto(`${B}/appointments/${ids[2]}/checkout`);
  // No bill yet: "Start checkout" opens it (tried a few times: the first tap can come before the page is ready).
  for (let i = 0; i < 4 && !(await page.getByText(/^2 ·/).count()); i++) {
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.getByRole("button", { name: /fechamento|cobro|Start checkout/i }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await page.goto(`${B}/appointments/${ids[2]}/checkout`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await shoot("pay");

  const client = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: s.locale, extraHTTPHeaders: { "Accept-Language": s.locale } })).newPage();
  await client.goto(`${B}/book/${slug}?lang=${s.lang}`);
  await hideDev(client);
  await client.waitForTimeout(700);
  await client.screenshot({ path: `${dir}/book.png` });
  console.log(s.lang, "done", dir);
  await ctx.close();
}
await db.end();
await browser.close();
