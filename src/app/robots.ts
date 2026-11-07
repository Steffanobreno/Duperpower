import type { MetadataRoute } from "next";

const base = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

// The sales and legal pages are public; the app and clients' private links are not for search.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/terms", "/privacy", "/signup", "/llms.txt"],
      disallow: ["/today", "/calendar", "/clients", "/appointments", "/settings", "/admin", "/a/", "/r/", "/s/", "/u/", "/api/", "/welcome", "/help", "/login/reset/"] }],
    sitemap: `${base()}/sitemap.xml`,
  };
}
