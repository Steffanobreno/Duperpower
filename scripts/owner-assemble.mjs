// Builds src/lib/i18n/owner/<lang>.ts from translation chunks (<dir>/<lang>-*.json, objects of
// "index": "text" for OWNER_KEYS). Usage: node scripts/owner-assemble.mjs <dir> <lang> [...]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const keys = JSON.parse(readFileSync("src/lib/i18n/owner/keys.ts", "utf8").match(/= (\[[\s\S]*\]);/)[1]);
const [dir, ...langs] = process.argv.slice(2);
for (const lang of langs) {
  const all = {};
  for (const f of readdirSync(dir).filter((f) => f.startsWith(`${lang}-`) && f.endsWith(".json"))) Object.assign(all, JSON.parse(readFileSync(`${dir}/${f}`, "utf8")));
  const list = keys.map((k, i) => {
    const v = all[i] ?? "";
    // The same {placeholders} as the English, or it falls back to English.
    const ph = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    if (v && ph(v) !== ph(k)) { console.error(`${lang} ${i}: placeholders differ: ${k} → ${v}`); return ""; }
    return v === k ? "" : v;
  });
  const missing = list.filter((v, i) => !v && /[A-Za-z]{3}/.test(keys[i].replace(/\{\w+\}/g, ""))).length;
  writeFileSync(`src/lib/i18n/owner/${lang}.ts`, `// The groomer's app in ${lang}, in the order of ./keys.ts ("" = same as English).\nexport const ${lang}: string[] = ${JSON.stringify(list, null, 0).replace(/","/g, '",\n"')};\n`);
  console.log(`${lang}: ${list.length} lines, ${missing} left in English`);
}
