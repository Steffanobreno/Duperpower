import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicBusiness } from "@/lib/booking";
import { bookingStructuredData } from "@/lib/local-business-ld";
import { BookScreen } from "../book-screen";

export const dynamic = "force-dynamic";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SLUG = /^[a-z0-9-]{2,60}$/;

// Each business's page has its own name in search results (not the same "Book a visit" for all),
// and a paused booking page stays out of search.
export async function generateMetadata({ params }: PageProps<"/book/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const b = SLUG.test(slug) ? await getPublicBusiness(slug) : null;
  if (!b) return { title: "Book a visit", robots: { index: false } };
  return {
    title: `Book with ${b.name}`,
    description: `Book a mobile grooming visit with ${b.name} online: pick your services and a time that works.`,
    alternates: { canonical: `${appUrl()}/book/${slug}` },
    robots: { index: b.online_booking_enabled },
  };
}

// A business's own booking link: /book/<its booking slug> (Settings → Business).
export default async function BusinessBookPage({ params, searchParams }: PageProps<"/book/[slug]">) {
  const { slug } = await params;
  // A malformed link must not fall back to the first business on the app.
  if (!SLUG.test(slug)) notFound();
  const b = await getPublicBusiness(slug);
  // The groomer as a local business for search and AI answers, while booking is open.
  const ld = b?.online_booking_enabled ? await bookingStructuredData(b.id, `${appUrl()}/book/${slug}`, appUrl()) : null;
  return (
    <>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />}
      {await BookScreen({ slug, query: await searchParams })}
    </>
  );
}
