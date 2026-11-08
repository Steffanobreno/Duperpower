// "Online booking by Fino": client pages carry a link with the groomer's referral code, and a groomer who
// signs up through it is that groomer's referral. Run after slice.mjs and report-card.mjs.
// Usage: node tests/e2e/powered-by.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = postgres(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/woofers", { max: 1 });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => { throw new Error(msg); };
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

let [row] = await db`select a.report_token as token, b.id, b.booking_slug as slug from appointments a join businesses b on b.id = a.business_id
                     where a.report_token is not null limit 1`;
if (!row) {
  [row] = await db`update appointments set report_token = md5(random()::text) where id = (select id from appointments order by created_at limit 1)
                   returning report_token as token, business_id as id, (select booking_slug from businesses where id = business_id) as slug`;
}
if (!row) fail("no appointment to take a report token from (run slice.mjs first)");

async function footerHref(path) {
  await page.goto(`${BASE}${path}`);
  const link = page.locator("footer").getByRole("link", { name: "Fino", exact: true });
  await link.waitFor();
  if ((await link.getAttribute("rel")) !== "noopener") fail(`${path}: the Fino link needs rel=noopener`);
  return link.getAttribute("href");
}

// 1. The booking page and the report card both link to Fino with this business's code.
const bookHref = await footerHref(`/book/${row.slug}`);
const [{ referral_code: code }] = await db`select referral_code from businesses where id = ${row.id}`;
if (!code) fail("the referral code should exist once the page was opened");
const want = `?ref=${code}&utm_source=powered_by`;
if (!bookHref?.endsWith(want)) fail(`booking footer link ${bookHref} should end with ${want}`);
step("booking page: the Fino link carries the groomer's referral code");
const gHref = await footerHref(`/g/${row.token}`);
if (!gHref?.endsWith(want)) fail(`report card footer link ${gHref} should end with ${want}`);
step("report card: the same link");

// 2. The landing page keeps ref and utm_source on its sign-up links.
await page.goto(gHref);
const start = page.locator('a[href^="/signup"]');
const hrefs = await start.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
if (!hrefs.length || hrefs.some((h) => h !== `/signup${want}`)) fail(`landing sign-up links lost the tags: ${JSON.stringify(hrefs)}`);
step("landing: every sign-up link keeps ref and utm_source");

// 3. Sign up through it: the source keeps both, and the referral is recorded.
const email = `powered-${Date.now()}@example.com`;
await start.first().click();
await page.waitForURL(/\/signup\?/);
await page.getByLabel("Business name").fill("Tail Waggers");
await page.getByLabel("Your name").fill("Rae");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("sudsy sudsy 123");
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: "Create my account" }).click();
await page.waitForURL(/\/welcome/);
const [nb] = await db`select b.id, b.signup_source from businesses b join staff s on s.business_id = b.id join users u on u.id = s.user_id where u.email = ${email}`;
if (nb.signup_source !== `${code} / powered_by`) fail(`signup_source is ${JSON.stringify(nb.signup_source)}`);
const [ref] = await db`select referrer_id from referrals where referred_id = ${nb.id}`;
if (ref?.referrer_id !== row.id) fail("the sign-up should count as this groomer's referral");
step("sign-up: source is \"<code> / powered_by\" and the referral is recorded");

if (errors.length) fail(`page errors: ${errors.join("; ")}`);
await browser.close();
await db.end();
