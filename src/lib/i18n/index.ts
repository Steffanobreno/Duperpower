// The pages clients see (booking, their appointment link, receipts) in the 20 most spoken
// languages in the world. English is the source: every phrase is written in English
// in the code and looked up in the other languages' lists; a phrase that isn't translated yet
// just shows in English. Owner screens stay in English.

export const LANGS = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "zh", name: "中文" },
  { code: "tl", name: "Tagalog" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "ko", name: "한국어" },
  { code: "pt", name: "Português" },
  { code: "hi", name: "हिन्दी" },
  { code: "fr", name: "Français" },
  { code: "ar", name: "العربية" },
  { code: "bn", name: "বাংলা" },
  { code: "ru", name: "Русский" },
  { code: "ur", name: "اردو" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "de", name: "Deutsch" },
  { code: "ja", name: "日本語" },
  { code: "mr", name: "मराठी" },
  { code: "te", name: "తెలుగు" },
  { code: "tr", name: "Türkçe" },
  { code: "ta", name: "தமிழ்" },
] as const;

export type Lang = (typeof LANGS)[number]["code"];
export type Messages = Record<string, string>;

export const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.code === v);

/** For dates and times (Intl). */
export const LOCALES: Record<Lang, string> = {
  en: "en-US", es: "es-US", zh: "zh-CN", tl: "fil-PH", vi: "vi-VN", ko: "ko-KR", pt: "pt-BR",
  hi: "hi-IN", fr: "fr-FR", ar: "ar", bn: "bn-BD", ru: "ru-RU", ur: "ur-PK", id: "id-ID",
  de: "de-DE", ja: "ja-JP", mr: "mr-IN", te: "te-IN", tr: "tr-TR", ta: "ta-IN",
};

/** Languages written right to left. */
export const RTL = new Set<Lang>(["ar", "ur"]);
export const dirOf = (lang: Lang) => (RTL.has(lang) ? "rtl" : "ltr");

/** The best language for an Accept-Language header ("es-MX,es;q=0.9,en;q=0.8" → es). */
export function fromAcceptLanguage(header: string | null): Lang {
  for (const part of (header ?? "").split(",")) {
    const code = part.trim().split(";")[0].toLowerCase();
    const base = code === "fil" ? "tl" : code === "in" ? "id" : code.split("-")[0];
    if (isLang(base)) return base;
  }
  return "en";
}

/** Fills "{name}" placeholders. */
const fill = (s: string, vars?: Record<string, string | number | null | undefined>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k] ?? "") : m)) : s;

export type T = (english: string, vars?: Record<string, string | number | null | undefined>) => string;

/** t("Welcome back, {name}!", { name }) in the chosen language, or in English when missing. */
export const makeT = (messages: Messages): T => (english, vars) => fill(messages[english] ?? english, vars);

// Messages the server sends back with a name or number in them, matched by shape so the page
// can show them translated too ("Pick Luna's size." → "Elige el tamaño de Luna.").
const SHAPES: [RegExp, string][] = [
  [/^Pick (.+)'s size\.$/, "Pick {name}'s size."],
  [/^Pick one service for (.+)\.$/, "Pick one service for {name}."],
  [/^That service doesn't match (.+)'s size\.$/, "That service doesn't match {name}'s size."],
  [/^Please text us at (.+) to book your next visit\.$/, "Please text us at {phone} to book your next visit."],
];
const SHAPE_VARS = ["name", "name", "name", "phone"];

/** A message from the server (English), in the chosen language when we know it. */
export function translateServerMessage(t: T, message: string) {
  for (const [i, [re, english]] of SHAPES.entries()) {
    const m = message.match(re);
    if (m) return t(english, { [SHAPE_VARS[i]]: m[1] });
  }
  return t(message);
}

/** Marks a phrase to translate later with t(), for lists written outside a component. */
export const msg = (english: string) => english;
