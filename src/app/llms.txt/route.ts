import { APP_NAME } from "@/lib/product";
import { landingCopy } from "../landing-copy";

// A plain summary of the product for AI assistants and answer engines (llms.txt).
export function GET() {
  const c = landingCopy("en").c;
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const body = [
    `# ${APP_NAME}`,
    "",
    `> ${c.meta.description}`,
    "",
    `${APP_NAME} is a scheduling and business app for mobile dog groomers (groomers who work from a van).`,
    "",
    "## What it does",
    ...c.rows.map((r) => `- ${r.title} ${r.text}`),
    ...c.tiles.map((t) => `- ${t.title}: ${t.text}.`),
    "",
    "## Pricing",
    `- ${c.pricing.sub}`,
    "",
    "## Questions",
    ...c.faq.items.map((f) => `- ${f.q} ${f.a}`),
    "",
    "## Links",
    `- [Start a free trial](${base}/signup)`,
    `- [Terms](${base}/terms)`,
    `- [Privacy](${base}/privacy)`,
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
