// One-off helper, second pass after i18n-wrap.mjs:
// - `Remove ${l.name}` inside a component → t("Remove {name}", { name: l.name })
// - export const metadata = { title: "X" } → generateMetadata() with t("X")
// - module-level lists and maps of English labels → msg("…") (their screens then call t()).
// Usage: node scripts/i18n-wrap2.mjs file.tsx [...]
import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

const q = (s) => JSON.stringify(s);
const SKIP_ATTR = /^(className|href|src|key|id|name|value|defaultValue|action|formAction|style|d|download)$/;
const LABEL_KEYS = /^(label|title|hint|text|verb|when|help|description|empty|question|placeholder|heading|one|many|blurb|summary|note|desc|subtitle|cta|button|tip|caption)$/;
const english = (s) => /[A-Za-z]{2,}/.test(s) && /[A-Z][a-z]|[a-z]{2,} [a-z]{2,}/.test(s) && !/^(https?:|\/|#|\?|&|[a-z-]+:)/.test(s.trim()) && !/^[\w.+-]+@/.test(s);
const looksTechnical = (s) => /^[a-z0-9_.-]+$/.test(s) || /\b(bg|text|px|py|rounded|border|flex|grid|ring|font)-/.test(s);

for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, "utf8");
  const isClient = /^\s*["']use client["']/.test(src);
  if (/^\s*["']use server["']/.test(src)) continue;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const needs = new Set();
  let usesMsg = false;
  const tName = /const \{ t: tr \} = /.test(src) ? "tr" : "t";

  const componentOf = (node) => {
    let n = node.parent, found = null;
    while (n) {
      if (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
        let name = n.name?.text;
        if (!name && ts.isVariableDeclaration(n.parent)) name = n.parent.name.getText(sf);
        const isDefault = ts.isFunctionDeclaration(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
        if ((name && /^[A-Z]/.test(name)) || isDefault) found = n;
      }
      n = n.parent;
    }
    return found;
  };
  const atModuleLevel = (node) => {
    let n = node.parent;
    while (n && !ts.isSourceFile(n)) {
      if (ts.isFunctionLike(n)) return false;
      n = n.parent;
    }
    return true;
  };
  const inside = (node, pred) => { for (let n = node.parent; n; n = n.parent) if (pred(n)) return true; return false; };
  const varName = (e, used) => {
    let base = e.getText(sf).replace(/\(.*$/s, "").split(/[.\[\]!?\s]/).filter(Boolean).pop() ?? "x";
    base = base.replace(/\W/g, "") || "x";
    if (/^(length|toFixed|toString|toLowerCase|toUpperCase)$/.test(base)) base = "n";
    if (/^(money|fmt|dayLabel|timeLabel|minutesLabel|fullName)$/.test(base)) base = { money: "amount", fmt: "date", dayLabel: "day", timeLabel: "time", minutesLabel: "duration", fullName: "name" }[base];
    let name = base, i = 2;
    while (used.has(name)) name = base + i++;
    used.add(name);
    return name;
  };

  const visit = (node) => {
    // Template literals shown to people.
    if (ts.isTemplateExpression(node)) {
      const p = node.parent;
      const attr = ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent) ? p.parent.name.getText(sf) : "";
      const literal = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(" ");
      const tagged = ts.isTaggedTemplateExpression(p);
      const nested = node.templateSpans.some((s) => /`|\?|"/.test(s.expression.getText(sf)));
      const fn = componentOf(node);
      if (!tagged && !SKIP_ATTR.test(attr) && english(literal) && !looksTechnical(literal) && !nested && fn
        && !inside(node, (n) => ts.isCallExpression(n) && /^(t|tr|msg|sql|fetch|redirect|revalidatePath)$/.test(n.expression.getText(sf)))) {
        const used = new Set();
        let phrase = node.head.text;
        const vars = [];
        for (const s of node.templateSpans) {
          const n = varName(s.expression, used);
          vars.push(n === s.expression.getText(sf) ? n : `${n}: ${s.expression.getText(sf)}`);
          phrase += `{${n}}` + s.literal.text;
        }
        edits.push({ start: node.getStart(sf), end: node.end, text: `${tName}(${q(phrase)}, { ${vars.join(", ")} })` });
        needs.add(fn);
      }
    }
    // Labels in module-level lists and maps.
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && atModuleLevel(node) && english(node.text) && !looksTechnical(node.text)) {
      const p = node.parent;
      const key = ts.isPropertyAssignment(p) && p.initializer === node ? p.name.getText(sf).replace(/["']/g, "") : null;
      const inMetadata = inside(node, (n) => ts.isVariableDeclaration(n) && /^(metadata|viewport)$/.test(n.name.getText(sf)));
      const callee = inside(node, (n) => ts.isCallExpression(n) && /^(msg|sql)$/.test(n.expression.getText(sf)));
      // A value in a map/list (not a key, not an import, not a type).
      const isValue = (key !== null && (LABEL_KEYS.test(key) || /^[a-z_]+$/.test(key) || /^"[a-z_>]+"$/.test(p.name.getText(sf))))
        || (ts.isArrayLiteralExpression(p) && node.text.length > 1 && /^[A-Z]/.test(node.text));
      if (isValue && !inMetadata && !callee && !(key && /^(className|href|icon|perm|color|tone|path|d|key|id|value|kind|type)$/.test(key))) {
        edits.push({ start: node.getStart(sf), end: node.end, text: `msg(${q(node.text)})` });
        usesMsg = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  // export const metadata: Metadata = { title: "X" };
  const meta = src.match(/export const metadata(?:: Metadata)? = \{ title: "([^"]+)" \};/);
  let out = src;
  for (const fn of needs) {
    const decl = isClient ? `const { t${tName === "tr" ? ": tr" : ""} } = useT();` : `const { t${tName === "tr" ? ": tr" : ""} } = await getOwnerI18n();`;
    if (fn.body && ts.isBlock(fn.body)) {
      if (!fn.body.getText(sf).includes(decl)) edits.push({ start: fn.body.getStart(sf) + 1, end: fn.body.getStart(sf) + 1, text: `\n  ${decl}` });
    } else if (fn.body) {
      edits.push({ start: fn.body.getStart(sf), end: fn.body.getStart(sf), text: `{\n  ${decl}\n  return ` });
      edits.push({ start: fn.body.end, end: fn.body.end, text: `;\n}` });
    }
    if (!isClient && !fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) {
      const at = fn.getStart(sf);
      const pre = src.slice(at).match(/^(export\s+(default\s+)?)?/)[0];
      edits.push({ start: at + pre.length, end: at + pre.length, text: "async " });
    }
  }
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let lastStart = Infinity;
  for (const e of edits) {
    if (e.end > lastStart && e.start !== e.end) continue;
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    if (e.start !== e.end) lastStart = e.start;
  }
  if (meta) {
    out = out.replace(meta[0], `export async function generateMetadata(): Promise<Metadata> {\n  const { t } = await getOwnerI18n();\n  return { title: t(${q(meta[1])}) };\n}`);
  }
  const imports = [];
  if (needs.size && isClient && !out.includes(`from "@/components/i18n"`)) imports.push(`import { useT } from "@/components/i18n";`);
  if ((needs.size && !isClient || meta) && !out.includes(`import { getOwnerI18n }`)) imports.push(`import { getOwnerI18n } from "@/lib/i18n/server";`);
  if (usesMsg && !/import \{[^}]*\bmsg\b[^}]*\} from "@\/lib\/i18n"/.test(out)) imports.push(`import { msg } from "@/lib/i18n";`);
  if (!edits.length && !meta) continue;
  if (imports.length) {
    const m = out.match(/^(["']use (client|server)["'];?[^\n]*\n)?/);
    out = out.slice(0, m[0].length) + imports.join("\n") + "\n" + out.slice(m[0].length);
  }
  writeFileSync(file, out);
  console.log(`${file}: ${edits.length} edits${meta ? " + title" : ""}${usesMsg ? " (msg)" : ""}`);
}
