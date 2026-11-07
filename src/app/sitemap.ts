import type { MetadataRoute } from "next";

const base = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const b = base();
  return [
    { url: `${b}/`, changeFrequency: "weekly", priority: 1, alternates: { languages: { en: `${b}/?lang=en`, pt: `${b}/?lang=pt`, es: `${b}/?lang=es` } } },
    { url: `${b}/signup`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${b}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${b}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
