import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { getStaff } from "@/lib/auth";
import { dirOf, fromAcceptLanguage, isLang, LOCALES, makeT, type Lang } from ".";
import { MESSAGES } from "./messages";
import { OWNER_MESSAGES } from "./owner";

/**
 * The client's language: ?lang= on the page, then the one they picked before (cookie), then the
 * page they came from (inside the website's frame cookies may be blocked), then the phone's.
 */
export async function getLang(param?: unknown): Promise<Lang> {
  if (isLang(param)) return param;
  const jar = await cookies();
  const saved = jar.get("lang")?.value;
  if (isLang(saved)) return saved;
  const h = await headers();
  const fromPage = (() => {
    try {
      return new URL(h.get("referer") ?? "").searchParams.get("lang");
    } catch {
      return null;
    }
  })();
  if (isLang(fromPage)) return fromPage;
  return fromAcceptLanguage(h.get("accept-language"));
}

/** The language, its phrases (to hand to the page's client parts) and t() for the server parts. */
export async function getI18n(param?: unknown) {
  const lang = await getLang(param);
  const messages = MESSAGES[lang];
  return { lang, messages, t: makeT(messages) };
}

/**
 * For the groomer's app: the logged-in person's language, its phrases (for the client parts)
 * and t() for the server parts. Before login: the phone's language.
 */
export const getOwnerI18n = cache(async () => {
  const staff = await getStaff();
  const lang = staff?.lang ?? fromAcceptLanguage((await headers()).get("accept-language"));
  const messages = OWNER_MESSAGES[lang];
  return { lang, messages, t: makeT(messages), locale: LOCALES[lang], dir: dirOf(lang) };
});

/**
 * Like getOwnerI18n, for the pages before login that a site link can open in a language
 * (/signup?lang=pt, /login?lang=es): ?lang= wins over the phone's language.
 */
export async function ownerI18nFor(param: unknown) {
  const staff = await getStaff();
  const lang: Lang = staff?.lang ?? (isLang(param) ? param : fromAcceptLanguage((await headers()).get("accept-language")));
  const messages = OWNER_MESSAGES[lang];
  return { lang, messages, t: makeT(messages), locale: LOCALES[lang], dir: dirOf(lang) };
}
