import { notFound } from "next/navigation";
import { getPublicBusiness } from "@/lib/booking";
import { logoUrl } from "@/lib/business-logo";
import { getStaff } from "@/lib/auth";
import { regionForPage } from "@/lib/region-server";
import { safeReferralCode } from "@/lib/discounts";
import { phoneLabel } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { ClientShell, StepCard } from "@/components/client-shell";
import { I18nProvider } from "@/components/i18n";
import { IntakeForm } from "./intake-form";

/** The new-client form of one business (/intake/<slug>), or of the first one (/intake). */
export async function IntakeScreen({ slug, query }: { slug: string | null; query: Record<string, string | string[] | undefined> }) {
  const b = await getPublicBusiness(slug);
  if (!b) return slug ? notFound() : null;
  const [{ lang, messages, t }, logo, viewer, referralCode] = await Promise.all([getI18n(query.lang), logoUrl(b.id), getStaff(), safeReferralCode(b.id)]);
  const region = regionForPage(b, lang);
  const book = slug ? `/book/${slug}` : "/book";
  return (
    <ClientShell phone={b.phone} phoneLabel={phoneLabel(b.phone)} website={b.website_url} i18n={{ lang, t }} brand={{ name: b.name, logo }} referralCode={referralCode}
      staffBack={viewer?.businessId === b.id ? "/settings/booking" : null}>
      <I18nProvider lang={lang} messages={messages} region={region}>
        <StepCard>
          <IntakeForm slug={slug} bookUrl={`${book}${lang === "en" ? "" : `?lang=${lang}`}`} />
        </StepCard>
      </I18nProvider>
    </ClientShell>
  );
}
