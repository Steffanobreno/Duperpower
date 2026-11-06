import type { Lang, Messages } from "..";
import { OWNER_KEYS } from "./keys";
import { ar } from "./ar";
import { bn } from "./bn";
import { de } from "./de";
import { es } from "./es";
import { fr } from "./fr";
import { hi } from "./hi";
import { id } from "./id";
import { ja } from "./ja";
import { ko } from "./ko";
import { mr } from "./mr";
import { pt } from "./pt";
import { ru } from "./ru";
import { ta } from "./ta";
import { te } from "./te";
import { tl } from "./tl";
import { tr } from "./tr";
import { ur } from "./ur";
import { vi } from "./vi";
import { zh } from "./zh";

// Each language is a list in the order of OWNER_KEYS (the English). "" keeps the English.
const zip = (list: string[]): Messages =>
  Object.fromEntries(OWNER_KEYS.flatMap((k, i) => (list[i] ? [[k, list[i]]] : [])));

/** The groomer's app phrases in every language (English is the code itself). Server only. */
export const OWNER_MESSAGES: Record<Lang, Messages> = {
  en: {}, es: zip(es), zh: zip(zh), tl: zip(tl), vi: zip(vi), ko: zip(ko), pt: zip(pt), hi: zip(hi), fr: zip(fr),
  ar: zip(ar), bn: zip(bn), ru: zip(ru), ur: zip(ur), id: zip(id), de: zip(de), ja: zip(ja), mr: zip(mr),
  te: zip(te), tr: zip(tr), ta: zip(ta),
};
