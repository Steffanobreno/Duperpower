import type { Metadata } from "next";
import { BookScreen } from "./book-screen";

export const metadata: Metadata = { title: "Book a visit", robots: { index: true } };
export const dynamic = "force-dynamic";

// ?embed=1 hides the header and footer, for showing this page inside the website.
export default async function BookPage({ searchParams }: PageProps<"/book">) {
  return BookScreen({ slug: null, query: await searchParams });
}

