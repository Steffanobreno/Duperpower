import type { MetadataRoute } from "next";
import { publicGuides } from "./(site)/guides/public-guides";

const base = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

// The public pages, each with its English, Portuguese and Spanish versions (the same URLs as the
// pages' own canonical and hreflang links: English is the plain path).
const PAGES: { path: string; priority: number; freq: "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, freq: "weekly" },
  { path: "/features", priority: 0.9, freq: "monthly" },
  { path: "/pricing", priority: 0.9, freq: "monthly" },
  { path: "/mobile-grooming-software", priority: 0.8, freq: "monthly" },
  { path: "/mobile-grooming-route-planner", priority: 0.8, freq: "monthly" },
  { path: "/switch", priority: 0.7, freq: "monthly" },
  { path: "/guides", priority: 0.7, freq: "monthly" },
  ...publicGuides("en").map((a) => ({ path: `/guides/${a.slug}`, priority: 0.5, freq: "monthly" as const })),
];

export default function sitemap(): MetadataRoute.Sitemap {
  const b = base();
  const url = (path: string, lang: string) => `${b}${path}${lang === "en" ? "" : `?lang=${lang}`}`;
  return [
    ...PAGES.map((p) => ({
      url: url(p.path, "en"), changeFrequency: p.freq, priority: p.priority,
      alternates: { languages: { en: url(p.path, "en"), pt: url(p.path, "pt"), es: url(p.path, "es"), "x-default": url(p.path, "en") } },
    })),
    { url: `${b}/signup`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${b}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${b}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
