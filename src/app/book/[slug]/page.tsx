import type { Metadata } from "next";
import { BookScreen } from "../book-screen";

export const metadata: Metadata = { title: "Book a visit", robots: { index: true } };
export const dynamic = "force-dynamic";

// A business's own booking link: /book/<its booking slug> (Settings → Business).
export default async function BusinessBookPage({ params, searchParams }: PageProps<"/book/[slug]">) {
  const { slug } = await params;
  return BookScreen({ slug, query: await searchParams });
}
