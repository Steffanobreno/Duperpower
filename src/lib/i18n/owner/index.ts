import type { Lang, Messages } from "..";

/** The groomer's app phrases in every language (English is the code itself). Server only. */
export const OWNER_MESSAGES: Record<Lang, Messages> = Object.fromEntries(
  ["en", "es", "zh", "tl", "vi", "ko", "pt", "hi", "fr", "ar", "bn", "ru", "ur", "id", "de", "ja", "mr", "te", "tr", "ta"].map((l) => [l, {}]),
) as Record<Lang, Messages>;
