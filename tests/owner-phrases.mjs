// The phrases of the groomer's app: every t("…"), tr("…") and msg("…") in its screens, and the
// error and warning messages its server actions send back (shown translated in a popup).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const CLIENT_ONLY = /src\/components\/(client-shell|receipt-view|i18n)\.tsx$/;
export const ownerFiles = () => [
  ...walk("src/app/(owner)"), ...walk("src/app/login"), ...walk("src/app/signup"), ...walk("src/app/setup"), ...walk("src/app/billing"),
  ...walk("src/components").filter((f) => !CLIENT_ONLY.test(f)),
  ...walk("src/lib").filter((f) => !f.includes("/i18n/")),
].filter((f) => /\.(tsx?|mjs)$/.test(f));

const unescape = (s) => s.replace(/\\(.)/g, "$1");
export function ownerPhrases() {
  const used = new Map(); // phrase -> first file
  for (const f of ownerFiles()) {
    const src = readFileSync(f, "utf8");
    const isAction = /^\s*["']use server["']/.test(src);
    for (const m of src.matchAll(/\b(?:t|tr|msg)\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g)) {
      const k = unescape(m[1] ?? m[2]);
      if (!used.has(k)) used.set(k, f);
    }
    if (isAction) for (const m of src.matchAll(/\b(?:error|warning): "((?:[^"\\]|\\.)*)"/g)) if (!used.has(unescape(m[1]))) used.set(unescape(m[1]), f);
  }
  return used;
}

if (process.argv[1]?.endsWith("owner-phrases.mjs")) {
  const used = ownerPhrases();
  if (process.argv[2] === "--json") console.log(JSON.stringify([...used.keys()], null, 1));
  else console.log(`${used.size} phrases, ${[...used.keys()].join(" ").split(/\s+/).length} words`);
}
