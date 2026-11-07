import { APP_NAME } from "@/lib/product";
import { landingCopy, PLAN_PRICES } from "../landing-copy";
import { featuresCopy, pricingCopy } from "../site-copy";
import { publicGuides } from "../(site)/guides/public-guides";

// A plain summary of the product for AI assistants and answer engines (llms.txt): what it is,
// every feature, the price and the billing rules, and links to the pages with the details.
export function GET() {
  const c = landingCopy("en").c;
  const f = featuresCopy("en");
  const p = pricingCopy("en");
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const body = [
    `# ${APP_NAME}`,
    "",
    `> ${c.meta.description}`,
    "",
    `${APP_NAME} is a scheduling and business app for mobile dog groomers (groomers who work from a van). It runs in the phone's browser and can be installed on the home screen. Groomers sign up themselves; their clients book on the groomer's own page without an app.`,
    "",
    "## Features",
    ...f.groups.flatMap((g) => [`### ${g.title}`, ...g.items.map((it) => `- ${it.t}: ${it.d}`), ""]),
    "## Pricing",
    `- US$${PLAN_PRICES.monthly} a month, or US$${PLAN_PRICES.yearly} a year (2 months free), for the whole business.`,
    `- ${p.sub}`,
    `- ${p.trial}`,
    ...p.faq.map((x) => `- ${x.q} ${x.a}`),
    `- ${p.referral.title} ${p.referral.text}`,
    "",
    "## Questions",
    ...c.faq.items.map((x) => `- ${x.q} ${x.a}`),
    "",
    "## Pages",
    `- [Features](${base}/features)`,
    `- [Pricing](${base}/pricing)`,
    `- [Mobile grooming software](${base}/mobile-grooming-software)`,
    `- [Route planner for mobile groomers](${base}/mobile-grooming-route-planner)`,
    `- [Switch from another grooming app](${base}/switch)`,
    `- [Guides](${base}/guides)`,
    `- [Start a free trial](${base}/signup)`,
    `- [Terms](${base}/terms)`,
    `- [Privacy](${base}/privacy)`,
    "",
    "## Guides (step by step)",
    ...publicGuides("en").map((a) => `- [${a.title}](${base}/guides/${a.slug}): ${a.summary}`),
    "",
    "Pages are also in Portuguese (?lang=pt) and Spanish (?lang=es).",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
