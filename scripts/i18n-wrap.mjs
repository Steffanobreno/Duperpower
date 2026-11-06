// One-off helper: wraps the English text of the given .tsx files in t("…") so the groomer's
// app can be translated. Adds `const { t } = useT()` (client files) or
// `const { t } = await getOwnerI18n()` (server files) to each component that needs it.
// Usage: node scripts/i18n-wrap.mjs file.tsx [...]   Prints what it skipped.
import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

const ATTRS = new Set(["label", "aria-label", "title", "hint", "placeholder", "submitLabel", "savedLabel", "savedText",
  "text", "submit", "overrideLabel", "legend", "empty", "question", "alt"]);
const ENTITIES = { "&apos;": "'", "&quot;": '"', "&amp;": "&", "&nbsp;": " ", "&middot;": "·", "&rarr;": "→", "&larr;": "←", "&hellip;": "…", "&mdash;": "—", "&ndash;": "–", "&lt;": "<", "&gt;": ">" };
const decode = (s) => s.replace(/&[a-z]+;/g, (e) => ENTITIES[e] ?? e);
const hasWords = (s) => /[A-Za-z]{2,}/.test(s) && !/^[A-Z0-9_]+$/.test(s.trim()) && !/^(https?:|\/|#|mailto:|tel:)/.test(s.trim());
const q = (s) => JSON.stringify(s);

for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, "utf8");
  const isClient = /^\s*["']use client["']/.test(src);
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const T = /\b(?:const|let|var)\s+t\b|[(,]\s*t\s*[,)=:]|\bt\s*=>/.test(src.replace(/const \{ t \} = (await getOwnerI18n|useT)\(\)/g, "")) ? "tr" : "t";
  const edits = []; // { start, end, text }
  const needs = new Map(); // component fn node -> true
  const skipped = [];

  const componentOf = (node) => {
    let n = node.parent;
    let found = null;
    while (n) {
      if (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
        let name = n.name?.text;
        if (!name && ts.isVariableDeclaration(n.parent)) name = n.parent.name.getText();
        const isDefault = ts.isFunctionDeclaration(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
        if ((name && /^[A-Z]/.test(name)) || isDefault) found = n;
      }
      n = n.parent;
    }
    return found;
  };
  const add = (node, start, end, text, what) => {
    const fn = componentOf(node);
    if (!fn) { skipped.push(what); return; }
    // Inside a "use server" action, leave as is.
    edits.push({ start, end, text });
    needs.set(fn, true);
  };
  const lit = (node) => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
  // String literals in an expression that are shown as text: a ? "A" : "B", x || "None", ("A").
  const wrapExpr = (e, label) => {
    if (!e) return;
    if (lit(e)) {
      if (hasWords(e.text)) add(e, e.getStart(sf), e.end, `${T}(${q(e.text)})`, label + " " + e.text);
    } else if (ts.isConditionalExpression(e)) { wrapExpr(e.whenTrue, label); wrapExpr(e.whenFalse, label); }
    else if (ts.isBinaryExpression(e) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(e.operatorToken.kind)) wrapExpr(e.right, label);
    else if (ts.isParenthesizedExpression(e)) wrapExpr(e.expression, label);
  };
  const simple = (e) => ts.isIdentifier(e) || ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e) || ts.isCallExpression(e) || ts.isNonNullExpression(e);
  const varName = (e, used) => {
    let base = e.getText(sf).replace(/\(.*$/s, "").split(/[.\[\]!?]/).filter(Boolean).pop() ?? "x";
    base = base.replace(/\W/g, "") || "x";
    if (/^(length|toFixed|toString)$/.test(base)) base = "n";
    let name = base, i = 2;
    while (used.has(name)) name = base + i++;
    used.add(name);
    return name;
  };

  const visitChildren = (parent) => {
    // Runs of text and simple {expressions} between elements become one phrase.
    const kids = parent.children;
    let run = [];
    const flush = () => {
      const texts = run.filter((k) => ts.isJsxText(k) && hasWords(decode(k.text)));
      if (texts.length) {
        const exprs = run.filter((k) => ts.isJsxExpression(k));
        const okExprs = exprs.every((k) => k.expression && simple(k.expression)) && exprs.length <= 4;
        // Trim the outer whitespace of the run.
        const first = run.find((k) => !(ts.isJsxText(k) && !k.text.trim()));
        const last = [...run].reverse().find((k) => !(ts.isJsxText(k) && !k.text.trim()));
        if (okExprs && exprs.length && first && last) {
          const used = new Set();
          let phrase = "";
          const vars = [];
          for (const k of run.slice(run.indexOf(first), run.indexOf(last) + 1)) {
            if (ts.isJsxText(k)) phrase += decode(k.text).replace(/\s+/g, " ");
            else { const n = varName(k.expression, used); vars.push(`${n}: ${k.expression.getText(sf)}`); phrase += `{${n}}`; }
          }
          let start = first.getStart(sf), end = last.end;
          if (ts.isJsxText(first)) start = first.pos + first.text.length - first.text.trimStart().length;
          if (ts.isJsxText(last)) end = last.end - (last.text.length - last.text.trimEnd().length);
          add(parent, start, end, `{${T}(${q(phrase.trim())}, { ${vars.join(", ")} })}`, "run " + phrase);
        } else {
          for (const k of texts) {
            const lead = k.text.length - k.text.trimStart().length, trail = k.text.length - k.text.trimEnd().length;
            const phrase = decode(k.text.trim()).replace(/\s+/g, " ");
            // Keep a space next to a neighbouring {expression}.
            const pre = lead && /\S/.test(k.text) && k.text.slice(0, lead).indexOf("\n") < 0 ? " " : "";
            const post = trail && k.text.slice(k.text.length - trail).indexOf("\n") < 0 ? " " : "";
            add(k, k.pos + lead, k.end - trail, `${pre ? "{\" \"}" : ""}{${T}(${q(phrase)})}${post ? "{\" \"}" : ""}`, "text " + phrase);
          }
        }
      }
      run = [];
    };
    for (const k of kids) {
      if (ts.isJsxText(k) || (ts.isJsxExpression(k) && k.expression && simple(k.expression))) run.push(k);
      else flush();
    }
    flush();
  };

  const visit = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) visitChildren(node);
    if (ts.isJsxAttribute(node) && ATTRS.has(node.name.getText(sf)) && node.initializer) {
      const init = node.initializer;
      if (ts.isStringLiteral(init) && hasWords(init.text)) add(node, init.getStart(sf), init.end, `{${T}(${q(decode(init.text))})}`, "attr " + init.text);
      else if (ts.isJsxExpression(init)) wrapExpr(init.expression, "attr");
    }
    if (ts.isJsxExpression(node) && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) && node.expression && !simple(node.expression)) wrapExpr(node.expression, "expr");
    ts.forEachChild(node, visit);
  };
  visit(sf);

  // Hooks at the top of each component that needs t.
  for (const fn of needs.keys()) {
    const decl = isClient ? `const { ${T === "t" ? "t" : "t: tr"} } = useT();` : `const { ${T === "t" ? "t" : "t: tr"} } = await getOwnerI18n();`;
    if (fn.body && ts.isBlock(fn.body)) {
      if (fn.body.getText(sf).includes(decl)) continue;
      edits.push({ start: fn.body.getStart(sf) + 1, end: fn.body.getStart(sf) + 1, text: `\n  ${decl}` });
    } else if (fn.body) {
      edits.push({ start: fn.body.getStart(sf), end: fn.body.getStart(sf), text: `{\n  ${decl}\n  return ` });
      edits.push({ start: fn.body.end, end: fn.body.end, text: `;\n}` });
    }
    if (!isClient && !fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) {
      const at = fn.getStart(sf);
      const isExportDefault = src.slice(at).match(/^(export\s+(default\s+)?)?/)[0];
      edits.push({ start: at + isExportDefault.length, end: at + isExportDefault.length, text: "async " });
    }
  }
  if (!edits.length) { if (skipped.length) console.log(`${file}: skipped ${skipped.length}: ${skipped.slice(0, 5).join(" | ")}`); continue; }

  // Apply from the end; drop edits nested inside another edit.
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let out = src;
  let lastStart = Infinity;
  for (const e of edits) {
    if (e.end > lastStart && e.start !== e.end) continue;
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    if (e.start !== e.end) lastStart = e.start;
  }
  const imp = isClient ? `import { useT } from "@/components/i18n";` : `import { getOwnerI18n } from "@/lib/i18n/server";`;
  if (!out.includes(imp.split(" from ")[0].replace("import ", "")) || !out.includes(imp.split(" from ")[1])) {
    const m = out.match(/^(["']use (client|server)["'];?\n)?/);
    out = out.slice(0, m[0].length) + imp + "\n" + out.slice(m[0].length);
  }
  writeFileSync(file, out);
  console.log(`${file}: ${edits.length} edits${skipped.length ? `, skipped ${skipped.length}: ${skipped.slice(0, 6).join(" | ")}` : ""}`);
}
