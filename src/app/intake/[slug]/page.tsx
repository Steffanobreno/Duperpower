import type { Metadata } from "next";
import { IntakeScreen } from "../intake-screen";

export const metadata: Metadata = { title: "New client form", robots: { index: false } };
export const dynamic = "force-dynamic";

// A business's own new-client form: /intake/<its booking slug>.
export default async function BusinessIntakePage({ params, searchParams }: PageProps<"/intake/[slug]">) {
  const { slug } = await params;
  return IntakeScreen({ slug, query: await searchParams });
}
