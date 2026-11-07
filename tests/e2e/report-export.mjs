// Reports as files, end to end. Run after slice.mjs (Maria Lopez paid by Venmo with a $38.80 tip).
// Reports → "Download PDF" and "Excel (CSV)" for This month, then for a custom period; the CSV
// has every section with Maria's payment and visit, the PDF opens and has pages.
// Usage: node tests/e2e/report-export.mjs [baseUrl] [screenshotDir]
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

const download = async (name) => {
  const [d] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name }).click()]);
  return { file: d.suggestedFilename(), body: readFileSync(await d.path()) };
};
const checkCsv = (csv, label) => {
  const text = csv.toString("utf8");
  if (!text.startsWith("﻿")) fail(`${label}: the CSV should start with a byte-order mark for Excel`);
  for (const s of ["Summary", "Collected (with tips)", "By payment method", "By groomer", "By service", "Payments", "Visits",
    "Maria Lopez", "Venmo", "38.80"]) {
    if (!text.includes(s)) fail(`${label}: the CSV is missing “${s}”`);
  }
};
const checkPdf = async (pdf, label) => {
  if (pdf.subarray(0, 4).toString() !== "%PDF") fail(`${label}: not a PDF`);
  const doc = await PDFDocument.load(pdf);
  if (doc.getPageCount() < 2) fail(`${label}: the PDF should have the summary and the detail pages`);
  return doc.getPageCount();
};

// A fixed period: the next 30 days hold the visit only if it is in this month; use the year.
await page.goto(`${BASE}/reports?period=year`);
await page.getByText("Collected", { exact: true }).first().waitFor();
if (SHOTS) await page.screenshot({ path: `${SHOTS}/R01-reports-download.png` });
const yPdf = await download("⬇ Download PDF");
if (!/^report-\d{4}-01-01-to-\d{4}-12-31\.pdf$/.test(yPdf.file)) fail(`unexpected PDF name ${yPdf.file}`);
const pages = await checkPdf(yPdf.body, "This year");
const yCsv = await download("⬇ Excel (CSV)");
if (!yCsv.file.endsWith(".csv")) fail(`unexpected CSV name ${yCsv.file}`);
checkCsv(yCsv.body, "This year");
step(`This year: PDF (${pages} pages) and CSV with summary, methods, groomers, services, payments and visits`);

// A custom period: the days typed in From and To.
const year = new Date().getFullYear();
const from = `${year - 1}-12-01`;
const to = `${year + 1}-01-31`;
await page.goto(`${BASE}/reports`);
await page.locator('input[name="from"]').fill(from);
await page.locator('input[name="to"]').fill(to);
await page.getByRole("button", { name: "Show" }).click();
await page.waitForURL(/from=/);
const cCsv = await download("⬇ Excel (CSV)");
if (cCsv.file !== `report-${from}-to-${to}.csv`) fail(`the custom CSV should cover ${from} to ${to}, got ${cCsv.file}`);
checkCsv(cCsv.body, "custom");
await checkPdf((await download("⬇ Download PDF")).body, "custom");
step("a custom period downloads the same files for the days typed");

// Without a login there's nothing to download.
const anon = await (await browser.newContext()).request.get(`${BASE}/reports/export?period=year&format=csv`, { maxRedirects: 0 });
if (anon.status() !== 401) fail(`a visitor should get 401, got ${anon.status()}`);
step("the export needs a login");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
