import type { Metadata } from "next";
import { getPublicBusiness } from "@/lib/booking";
import { logoUrl } from "@/lib/business-logo";
import { getStaff } from "@/lib/auth";
import { phoneLabel } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { ClientShell, StepCard } from "@/components/client-shell";
import { I18nProvider } from "@/components/i18n";
import { IntakeForm } from "./intake-form";

export const metadata: Metadata = { title: "New client form", robots: { index: false } };
export const dynamic = "force-dynamic";

// The new-client form the owner shares (Settings → Online booking): no booking, just the info.
export default async function IntakePage({ searchParams }: PageProps<"/intake">) {
  const b = await getPublicBusiness();
  if (!b) return null;
  const [{ lang, messages, t }, logo, viewer] = await Promise.all([getI18n((await searchParams).lang), logoUrl(b.id), getStaff()]);
  return (
    <ClientShell phone={b.phone} phoneLabel={phoneLabel(b.phone)} website={b.website_url} i18n={{ lang, t }} brand={{ name: b.name, logo }}
      staffBack={viewer?.businessId === b.id ? "/settings/booking" : null}>
      <I18nProvider lang={lang} messages={messages}>
        <StepCard>
          <IntakeForm bookUrl={`/book${lang === "en" ? "" : `?lang=${lang}`}`} />
        </StepCard>
      </I18nProvider>
    </ClientShell>
  );
}
