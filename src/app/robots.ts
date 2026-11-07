import type { MetadataRoute } from "next";

const base = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

// The sales and legal pages are public; the app and clients' private links are not for search.
const PRIVATE = ["/today", "/calendar", "/clients", "/appointments", "/settings", "/admin", "/billing", "/a/", "/r/", "/s/", "/u/",
  "/api/", "/welcome", "/help", "/login/reset/"];

// AI crawlers, named so the choice is visible and easy to change (decided 2026-11-07: all allowed,
// so assistants can find and describe Fino):
// - search and answers: OAI-SearchBot and ChatGPT-User (ChatGPT), Claude-SearchBot and
//   Claude-User (Claude), PerplexityBot and Perplexity-User (Perplexity);
// - model training: GPTBot (OpenAI), ClaudeBot (Anthropic), Google-Extended (Gemini), CCBot
//   (Common Crawl). To keep the site out of training, move these to `disallow: ["/"]`.
const AI_SEARCH = ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User"];
const AI_TRAINING = ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/features", "/pricing", "/mobile-grooming-software", "/mobile-grooming-route-planner", "/switch", "/guides", "/terms", "/privacy", "/signup", "/llms.txt"], disallow: PRIVATE },
      { userAgent: [...AI_SEARCH, ...AI_TRAINING], allow: ["/", "/llms.txt"], disallow: PRIVATE },
    ],
    sitemap: `${base()}/sitemap.xml`,
  };
}
