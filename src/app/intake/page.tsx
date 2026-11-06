import type { Metadata } from "next";
import { IntakeScreen } from "./intake-screen";

export const metadata: Metadata = { title: "New client form", robots: { index: false } };
export const dynamic = "force-dynamic";

// The new-client form the owner shares (Settings → Online booking): no booking, just the info.
export default async function IntakePage({ searchParams }: PageProps<"/intake">) {
  return IntakeScreen({ slug: null, query: await searchParams });
}
