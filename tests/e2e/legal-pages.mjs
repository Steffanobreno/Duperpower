// The Terms, the Privacy Policy and the public contact: every section the legal fixes ask for,
// the company placeholders (src/lib/legal.ts), the subprocessors and cookies, and the support
// email as a mailto: link on both pages and in the site footer. Also: a marketing email for a
// business that isn't the demo one doesn't say "Bay Area".
// Needs no login or data. Usage: node tests/e2e/legal-pages.mjs [baseUrl]
// SUPPORT_EMAIL must match the dev server's (unset here: the placeholder shows).
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SUPPORT = process.env.SUPPORT_EMAIL?.split(",")[0]?.trim() || "[E-MAIL DE SUPORTE]";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

const TERMS_HEADINGS = [
  "Who we are", "Business use only", "Your account and your team", "Free trial, plans, renewal and cancellation", "Refunds",
  "Referrals and discount codes", "Taxes", "Price changes", "Your clients’ data", "Agreement and message templates",
  "Messaging laws", "Acceptable use", "Availability", "Disclaimer of warranties and limitation of liability", "Indemnification",
  "Governing law and venue", "Assignment, entire agreement and severability", "Notices", "Contact",
];
const PRIVACY_HEADINGS = [
  "Who controls what", "What we collect", "What we use it for", "Legal bases (GDPR and LGPD)", "The “Online booking by Fino” line",
  "Subprocessors", "International transfers", "How long we keep it", "Children", "Cookies and browser storage",
  "Your rights and how to use them", "Contact and data protection officer", "We don’t sell personal information",
];
const SUBPROCESSORS = ["Neon", "Netlify", "Resend", "Gmail", "Google Maps", "OpenStreetMap", "Anthropic", "Stripe", "Google Drive"];
const COOKIES = ["wds_session", "lang", "woofers:unlocked-at"];

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

/** Opens a page and reads its h2s, its text and its mailto: links. */
async function open(path) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${path}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${path}: ${m.text()}`));
  const res = await page.goto(`${BASE}${path}`);
  if (res.status() !== 200) fail(`${path} → ${res.status()}`);
  const data = await page.evaluate(() => ({
    h2: [...document.querySelectorAll("main h2")].map((h) => h.textContent.trim()),
    text: document.body.innerText,
    // Includes the answers of closed questions.
    allText: document.body.textContent,
    mailto: [...document.querySelectorAll('a[href^="mailto:"]')].map((a) => ({ text: a.textContent.trim(), href: a.getAttribute("href") })),
    footerMailto: [...document.querySelectorAll('footer a[href^="mailto:"]')].map((a) => a.textContent.trim()),
  }));
  await page.close();
  return data;
}

function checkContact(path, d) {
  if (!d.mailto.some((a) => a.text === SUPPORT && decodeURIComponent(a.href) === `mailto:${SUPPORT}`)) {
    fail(`${path}: no mailto: link to ${SUPPORT} (found ${JSON.stringify(d.mailto)})`);
  }
  if (!d.footerMailto.includes(SUPPORT)) fail(`${path}: the footer has no support email`);
  if (/\bundefined\b/.test(d.text)) fail(`${path}: shows "undefined"`);
  if (!d.text.includes("© ") || !d.text.includes("[NOME DA EMPRESA]")) fail(`${path}: the footer doesn't name the company`);
}

const hasHeading = (h2s, wanted) => h2s.some((h) => h.replace(/^\d+\.\s*/, "") === wanted);

// Terms.
const terms = await open("/terms");
for (const h of TERMS_HEADINGS) if (!hasHeading(terms.h2, h)) fail(`/terms: no "${h}" section (has ${terms.h2.join(" | ")})`);
for (const s of ["[NOME DA EMPRESA]", "[FORO E LEI APLICÁVEL]", "14 days", "prorated", "Last updated: 2026-11-08"]) {
  if (!terms.text.includes(s)) fail(`/terms: missing "${s}"`);
}
if (/honou?rs? .?STOP|which the app does for you/i.test(terms.text)) fail("/terms: still says the app honors STOP");
checkContact("/terms", terms);
step(`/terms: ${TERMS_HEADINGS.length} sections, placeholders, refund policy and the support email`);

// Privacy.
const privacy = await open("/privacy");
for (const h of PRIVACY_HEADINGS) if (!hasHeading(privacy.h2, h)) fail(`/privacy: no "${h}" section (has ${privacy.h2.join(" | ")})`);
for (const s of [...SUBPROCESSORS, ...COOKIES, "[NOME DA EMPRESA]", "Last updated: 2026-11-08"]) {
  if (!privacy.text.includes(s)) fail(`/privacy: missing "${s}"`);
}
if (/stop texts by replying STOP/i.test(privacy.text)) fail("/privacy: says a STOP reply stops texts by itself");
if (/don.t use your clients. data for our own marketing/i.test(privacy.text)) fail("/privacy: still says client data is never used for Fino's marketing");
checkContact("/privacy", privacy);
step(`/privacy: ${PRIVACY_HEADINGS.length} sections, ${SUBPROCESSORS.length} subprocessors, the cookies and the support email`);

// The site footer.
const home = await open("/");
checkContact("/", home);
step("/: the footer names the company and links the support email");

// The pricing questions: the real trial rule and the refund policy.
const pricing = await open("/pricing");
for (const s of ["more than 48 hours", "prorated", "Monthly plans aren't refunded"]) {
  if (!pricing.allText.includes(s)) fail(`/pricing: missing "${s}"`);
}
if (/first charge only happens when the trial ends/.test(pricing.allText)) fail("/pricing: still promises no charge before the trial ends");
step("/pricing: the 48-hour trial rule and the refund policy");

// The marketing email: "Bay Area" only for the demo business (Woofers).
const render = (business) => execFileSync("node_modules/.bin/tsx", ["-e", `
  import { marketingEmailHtml, marketingEmailText } from "./src/lib/marketing-email.ts";
  const content = { banner: null, headline: "Hi", body: "Hello", buttonLabel: null, buttonUrl: null };
  const vars = { first_name: "Ana", pet_name: "Rex", business: ${JSON.stringify(business)}, booking_link: "http://x/book" };
  const args = { appUrl: "http://x", content, vars, phone: null, mailingAddress: "1 Main St", unsubscribeUrl: "http://x/u" };
  console.log(marketingEmailHtml(args) + marketingEmailText(args));
`], { encoding: "utf8" });
if (/Bay Area/.test(render("Happy Paws Grooming"))) fail('a marketing email from "Happy Paws Grooming" says "Bay Area"');
if (!/Bay Area/.test(render("Woofers Dog Spa"))) fail("the demo business's marketing email lost its Bay Area line");
step('marketing email: "Bay Area" only for the demo business');

if (errors.length) fail(`Page errors:\n${errors.join("\n")}`);
await browser.close();
console.log("legal pages: all passed");
