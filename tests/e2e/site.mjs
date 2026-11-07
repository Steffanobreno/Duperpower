// The public site, end to end: every page in English, Portuguese and Spanish answers, has its
// own title, one h1, a canonical, every language version, valid structured data, no sideways
// scroll from 320 px up, working links between pages, the phone menu, sitemap and llms.txt.
// Needs no login or data. Usage: node tests/e2e/site.mjs [baseUrl]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const PAGES = ["/", "/features", "/pricing", "/mobile-grooming-software", "/mobile-grooming-route-planner", "/switch"];
const LANGS = ["en", "pt", "es"];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

// Every page × language: head, h1, structured data.
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const titles = new Set();
for (const path of PAGES) {
  for (const lang of LANGS) {
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${path}?lang=${lang}: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(`${path}?lang=${lang}: ${m.text()}`));
    const res = await page.goto(`${BASE}${path}?lang=${lang}`);
    if (res.status() !== 200) fail(`${path}?lang=${lang} → ${res.status()}`);
    const head = await page.evaluate(() => ({
      title: document.title,
      lang: document.querySelector("[lang]:not(html)")?.getAttribute("lang"),
      h1: document.querySelectorAll("h1").length,
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
      hreflang: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => l.getAttribute("hreflang")).sort().join(","),
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
      og: document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
    }));
    const where = `${path}?lang=${lang}`;
    if (titles.has(head.title)) fail(`${where}: the title is used by another page: ${head.title}`);
    titles.add(head.title);
    if (head.lang !== lang) fail(`${where}: page language is ${head.lang}`);
    if (head.h1 !== 1) fail(`${where}: ${head.h1} h1`);
    const canonical = `${path}${lang === "en" ? "" : `?lang=${lang}`}`;
    if (!head.canonical?.endsWith(canonical)) fail(`${where}: canonical ${head.canonical}`);
    if (head.hreflang !== "en,es,pt,x-default") fail(`${where}: hreflang ${head.hreflang}`);
    if (head.description.length < 80 || head.description.length > 220) fail(`${where}: description length ${head.description.length}`);
    if (!head.og) fail(`${where}: no Open Graph title`);
    const ld = head.ld.flatMap((t) => [JSON.parse(t)].flat());
    if (!ld.length) fail(`${where}: no structured data`);
    if (path !== "/" && !ld.some((x) => x["@type"] === "BreadcrumbList")) fail(`${where}: no breadcrumb`);
    if (["/pricing", "/"].includes(path)) {
      const app = ld.find((x) => x["@type"] === "SoftwareApplication");
      if (!app?.offers?.some((o) => o.price === "29")) fail(`${where}: the US$29 offer is missing`);
    }
    await page.close();
  }
}
step(`${PAGES.length} pages × 3 languages: 200, own title, one h1, canonical, hreflang, description, Open Graph, structured data`);

// No sideways scroll on small phones, tablets and desktops.
for (const width of [320, 390, 768, 1440]) {
  const c = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await c.newPage();
  for (const path of PAGES) {
    await page.goto(`${BASE}${path}?lang=pt`);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > width) fail(`${path} scrolls sideways at ${width}px (${sw})`);
  }
  await c.close();
}
step("no sideways scroll at 320, 390, 768 and 1440 px");

// The footer links every page, and they all open; the phone menu opens.
const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await phone.goto(`${BASE}/switch?lang=es`);
const hrefs = await phone.locator("footer a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
for (const path of PAGES.filter((p) => p !== "/")) {
  if (!hrefs.includes(`${path}?lang=es`)) fail(`the footer should link ${path} in Spanish: ${hrefs}`);
}
for (const href of new Set(hrefs)) {
  const r = await fetch(new URL(href, BASE));
  if (r.status !== 200) fail(`footer link ${href} → ${r.status}`);
}
await phone.getByLabel("Menú").click();
await phone.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Precios", exact: true }).click();
await phone.waitForURL(/\/pricing\?lang=es/);
await phone.getByText("US$29").first().waitFor();
step("the footer links every page in the page's language and they open; the phone menu works");

// Sitemap and llms.txt list every page.
const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
const llms = await (await fetch(`${BASE}/llms.txt`)).text();
for (const path of PAGES.filter((p) => p !== "/")) {
  if (!sitemap.includes(`${path}</loc>`) || !sitemap.includes(`${path}?lang=pt"`)) fail(`sitemap misses ${path}`);
  if (!llms.includes(`${path})`)) fail(`llms.txt misses ${path}`);
}
if (!/US\$29 a month/.test(llms)) fail("llms.txt should give the price");
const robots = await (await fetch(`${BASE}/robots.txt`)).text();
if (!/User-Agent: OAI-SearchBot/i.test(robots) || /Disallow: \/pricing/.test(robots)) fail("robots.txt should name the AI crawlers and allow the pages");
step("sitemap, llms.txt and robots.txt cover every page");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("site: all good");
