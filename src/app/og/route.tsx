import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/product";
import { landingCopy, PLAN_PRICES } from "../landing-copy";
import { featuresCopy, guidesCopy, mobileCopy, pricingCopy, routeCopy, siteLang, switchCopy, type SiteLang } from "../site-copy";
import { publicGuide } from "../(site)/guides/public-guides";

// The picture shown when a site page is shared (WhatsApp, Facebook, iMessage, search and AI
// previews): 1200×630, the page's own title. It takes only the page's path and language and
// reads the words from the site's copy, so it can't be made to show anything else.

function words(path: string, lang: SiteLang): { kicker: string; title: string } | null {
  if (path === "/") { const c = landingCopy(lang).c; return { kicker: c.hero.badgeA, title: c.hero.title }; }
  if (path === "/features") { const f = featuresCopy(lang); return { kicker: f.kicker, title: f.title }; }
  if (path === "/pricing") { const p = pricingCopy(lang); return { kicker: `US$${PLAN_PRICES.monthly}${p.perMonth}`, title: p.title }; }
  const topics: Record<string, typeof mobileCopy> = { "/mobile-grooming-software": mobileCopy, "/mobile-grooming-route-planner": routeCopy, "/switch": switchCopy };
  if (topics[path]) { const t = topics[path](lang); return { kicker: t.kicker, title: t.title }; }
  if (path === "/guides") { const g = guidesCopy(lang); return { kicker: g.kicker, title: g.title }; }
  const guide = path.match(/^\/guides\/([a-z0-9-]+)$/);
  if (guide) { const a = publicGuide(guide[1], lang); return a ? { kicker: guidesCopy(lang).kicker, title: a.title } : null; }
  return null;
}

// The app icon, fetched from the site itself (Next serves it from src/app/icon.png), once.
let icon: Promise<string | null> | null = null;
async function iconData(origin: string) {
  icon ??= fetch(new URL("/icon.png", origin))
    .then(async (r) => (r.ok ? `data:image/png;base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}` : null))
    .catch(() => null);
  const got = await icon;
  if (!got) icon = null; // try again next time
  return got;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lang = siteLang(url.searchParams.get("lang") ?? "en");
  const w = words(url.searchParams.get("p") ?? "/", lang);
  if (!w) return new Response("Not found", { status: 404 });
  const note = pricingCopy(lang).trial;
  const logo = await iconData(url.origin);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0d0021", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse draws plain img tags */}
          {logo && <img src={logo} width={64} height={64} style={{ borderRadius: 16 }} alt="" />}
          <span style={{ fontSize: 40, fontWeight: 700 }}>{APP_NAME}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 30, color: "#f7be00", fontWeight: 600 }}>{w.kicker}</span>
          <span style={{ fontSize: w.title.length > 48 ? 64 : 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, marginTop: 16 }}>{w.title}</span>
        </div>
        <span style={{ fontSize: 28, color: "#cfcfcf" }}>{note}</span>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } },
  );
}
