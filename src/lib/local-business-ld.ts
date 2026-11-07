import "server-only";
import { sql } from "./db";
import { onlineServices } from "./booking";
import { logoUrl } from "./business-logo";

// Structured data for a groomer's own booking page (/book/<slug>): the business as a local
// business that comes to the client (name, phone, city, links, services with prices, and a
// "book" action), so search engines and AI assistants can show it as a grooming business.
// The street is left out on purpose: a mobile groomer's address is often their home.

type Biz = {
  id: string; name: string; phone: string | null; currency: string; city: string | null; state: string | null; zip: string | null;
  country: string; website_url: string | null; instagram_url: string | null; facebook_url: string | null; yelp_url: string | null; google_url: string | null;
};

export async function bookingStructuredData(businessId: string, pageUrl: string, appUrl: string) {
  const [b] = await sql<Biz[]>`
    select id, name, phone, currency, city, state, zip, country, website_url, instagram_url, facebook_url, yelp_url, google_url
    from businesses where id = ${businessId}`;
  if (!b) return null;
  const [services, logo] = await Promise.all([onlineServices(b.id), logoUrl(b.id)]);
  const links = [b.website_url, b.instagram_url, b.facebook_url, b.yelp_url, b.google_url].filter((u): u is string => !!u && /^https:\/\//.test(u));
  const place = b.city ? { "@type": "City", name: [b.city, b.state].filter(Boolean).join(", ") } : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: b.name,
    description: `Mobile pet grooming${b.city ? ` in ${b.city}` : ""}: book online.`,
    url: pageUrl,
    ...(b.phone ? { telephone: b.phone } : {}),
    ...(logo ? { image: new URL(logo, appUrl).toString(), logo: new URL(logo, appUrl).toString() } : {}),
    ...(b.city || b.zip ? {
      address: {
        "@type": "PostalAddress",
        ...(b.city ? { addressLocality: b.city } : {}), ...(b.state ? { addressRegion: b.state } : {}),
        ...(b.zip ? { postalCode: b.zip } : {}), addressCountry: b.country,
      },
    } : {}),
    ...(place ? { areaServed: place } : {}),
    ...(links.length ? { sameAs: links } : {}),
    ...(services.length ? {
      hasOfferCatalog: {
        "@type": "OfferCatalog", name: "Grooming services",
        itemListElement: services.filter((s) => s.kind === "service").slice(0, 30).map((s) => ({
          "@type": "Offer", priceCurrency: b.currency, price: (s.price_cents / 100).toFixed(2),
          itemOffered: { "@type": "Service", name: s.name, ...(s.description ? { description: s.description } : {}) },
        })),
      },
    } : {}),
    potentialAction: { "@type": "ReserveAction", target: { "@type": "EntryPoint", urlTemplate: pageUrl } },
  };
}
