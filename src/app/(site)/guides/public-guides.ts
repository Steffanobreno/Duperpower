import { helpArticles, TOPICS, type HelpArticle } from "@/lib/help/articles";

// The help center's articles that make sense outside the app (the troubleshooting one points at
// the in-app assistant, so it stays inside).
const INSIDE_ONLY = new Set(["troubleshooting"]);

export const publicGuides = (lang: string): HelpArticle[] => helpArticles(lang).filter((a) => !INSIDE_ONLY.has(a.slug));
export const publicGuide = (slug: string, lang: string) => publicGuides(lang).find((a) => a.slug === slug) ?? null;
export const GUIDE_TOPICS = TOPICS;
