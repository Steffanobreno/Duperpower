import { notFound } from "next/navigation";
import { getPublicBusiness, onlineServices } from "@/lib/booking";
import { activeAgreement, noShowFeeText } from "@/lib/agreement";
import { AgreementText } from "@/components/agreement-text";
import { ClientShell, StepCard } from "@/components/client-shell";
import { isYmd, phoneLabel, todayYmd } from "@/lib/format";
import { BookingWizard } from "./booking-wizard";
import { getI18n } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/i18n";
import { logoUrl } from "@/lib/business-logo";
import { safeReferralCode } from "@/lib/discounts";
import { getStaff } from "@/lib/auth";
import { regionForPage } from "@/lib/region-server";

/** The booking page of one business (/book/<slug>), or of the first one (/book). */
export async function BookScreen({ slug, query }: { slug: string | null; query: Record<string, string | string[] | undefined> }) {
  const b = await getPublicBusiness(slug);
  if (!b) return slug ? notFound() : null;
  const { embed, phone: resumePhone, lang: langParam, date: preferredDate } = query;
  const [services, agreement, { lang, messages, t }, logo] = await Promise.all([
    onlineServices(b.id), activeAgreement(b.id), getI18n(langParam), logoUrl(b.id),
  ]);
  const [viewer, referralCode] = await Promise.all([getStaff(), safeReferralCode(b.id)]);
  const region = regionForPage(b, lang);
  const phone = phoneLabel(b.phone);
  return (
    <ClientShell phone={b.phone} phoneLabel={phone} website={b.website_url} bare={embed === "1"} i18n={{ lang, t }}
      brand={{ name: b.name, logo }} referralCode={referralCode} staffBack={viewer?.businessId === b.id ? "/settings/booking" : null}>
      {b.online_booking_enabled ? (
        <I18nProvider lang={lang} messages={messages} region={region}>
          <BookingWizard
            timezone={b.timezone}
            services={services}
            businessName={b.name}
            businessPhone={phone}
            today={todayYmd(b.timezone)}
            agreementTitle={agreement?.title ?? null}
            agreement={agreement?.required_online ? <AgreementText title={agreement.title} body={agreement.body} noShowFee={noShowFeeText(agreement.no_show_fee_cents, t("a fee"))} /> : null}
            agreementVersion={agreement?.version ?? null}
            slug={slug}
            preferredDate={isYmd(preferredDate) ? preferredDate : null}
            initialPhone={typeof resumePhone !== "string" ? "" : b.country === "US" ? resumePhone.replace(/\D/g, "").slice(-10) : resumePhone.replace(/[^\d+]/g, "").slice(0, 16)}
          />
        </I18nProvider>
      ) : (
        <StepCard>
          <h1 className="text-2xl font-extrabold">{t("Online booking is paused")}</h1>
          <p className="mt-2 text-muted">{t("Please text us at {phone} and we'll find you a time.", { phone })}</p>
        </StepCard>
      )}
    </ClientShell>
  );
}
