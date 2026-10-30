import type { Lang, Messages } from "..";
import { es } from "./es";
import { ko } from "./ko";
import { pt } from "./pt";
import { tl } from "./tl";
import { vi } from "./vi";
import { zh } from "./zh";

/** Every language's phrases (English is the code itself). Server only: pages send one language down. */
export const MESSAGES: Record<Lang, Messages> = { en: {}, es, zh, tl, vi, ko, pt };
