// Every phrase the client pages translate with t("…") has a translation in every language,
// and no language has phrases nobody uses. Usage: node tests/i18n-check.mjs
import { readFileSync, readdirSync } from "node:fs";

const files = [
  "src/app/book/booking-wizard.tsx", "src/app/book/month-calendar.tsx", "src/app/book/signature-pad.tsx",
  "src/app/book/page.tsx", "src/app/book/book-screen.tsx", "src/app/a/[token]/page.tsx", "src/app/r/[token]/page.tsx", "src/app/g/[token]/page.tsx",
  "src/components/client-shell.tsx", "src/components/powered-by.tsx", "src/components/receipt-view.tsx", "src/lib/i18n/index.ts",
  "src/app/intake/intake-form.tsx", "src/app/intake/page.tsx", "src/app/intake/intake-screen.tsx", "src/app/s/[token]/page.tsx",
];
const unescape = (s) => s.replace(/\\(.)/g, "$1");
const used = new Set();
for (const f of files) {
  for (const m of readFileSync(f, "utf8").matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) used.add(unescape(m[1]));
}
// The groom tag labels the report card translates by key.
for (const m of readFileSync("src/lib/groom-tags.ts", "utf8").matchAll(/msg\("([^"]*)"\)/g)) used.add(m[1]);
// The shapes server messages are matched to (src/lib/i18n/index.ts) and the size names.
for (const m of readFileSync("src/lib/i18n/index.ts", "utf8").matchAll(/\/, "((?:[^"\\]|\\.)*)"\]/g)) used.add(unescape(m[1]));
for (const size of ["Small", "Medium", "Large", "X-Large"]) used.add(size);
// The size labels by weight and in cm (booking page, sized the business's way).
for (const m of readFileSync("src/lib/format.ts", "utf8").matchAll(/msg\("((?:Small|Medium|Large|X-Large) \((?:up to|\d)[^"]*(?:lb|kg|cm)[^"]*\))"\)/g)) used.add(m[1]);
// English messages the booking server actions send back (shown translated on the page).
for (const f of ["src/app/book/actions.ts", "src/lib/booking.ts", "src/app/intake/actions.ts"]) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/(?:error: |return )"((?:[^"\\]|\\.)*)"/g)) if (/[a-z]/.test(m[1]) && m[1].length > 12) used.add(unescape(m[1]));
}

let problems = 0;
const dir = "src/lib/i18n/messages";
for (const file of readdirSync(dir).filter((f) => f !== "index.ts")) {
  const keys = new Set();
  for (const line of readFileSync(`${dir}/${file}`, "utf8").split("\n")) {
    const m = line.match(/^\s+(?:"((?:[^"\\]|\\.)*)"|([A-Za-z]\w*)):/);
    if (m) keys.add(m[1] !== undefined ? unescape(m[1]) : m[2]);
  }
  const missing = [...used].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !used.has(k));
  if (missing.length || extra.length) problems++;
  for (const k of missing) console.error(`${file}: missing "${k}"`);
  for (const k of extra) console.error(`${file}: not used "${k}"`);
}
console.log(`${used.size} phrases checked in ${readdirSync(dir).length - 1} languages`);
if (problems) process.exit(1);
console.log("All good.");
