import type { Lang, Messages } from "..";
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

/** Every language's phrases (English is the code itself). Server only: pages send one language down. */
export const MESSAGES: Record<Lang, Messages> = { en: {}, es, ko, pt, tl, vi, zh, hi, fr, ar, bn, ru, ur, id, de, ja, mr, te, tr, ta };
