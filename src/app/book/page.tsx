import type { Metadata } from "next";
import { getPublicBusiness, onlineServices } from "@/lib/booking";
import { activeAgreement } from "@/lib/agreement";
import { AgreementText } from "@/components/agreement-text";
import { ClientShell, StepCard } from "@/components/client-shell";
import { phoneLabel, todayYmd } from "@/lib/format";
import { BookingWizard } from "./booking-wizard";
import { getI18n } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/i18n";
import { logoUrl } from "@/lib/business-logo";
import { getStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Book a visit", robots: { index: true } };
export const dynamic = "force-dynamic";

// ?embed=1 hides the header and footer, for showing this page inside the website.
export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const b = await getPublicBusiness();
  if (!b) return null;
  const { embed, phone: resumePhone, lang: langParam } = await searchParams;
  const [services, agreement, { lang, messages, t }, logo] = await Promise.all([
    onlineServices(b.id), activeAgreement(b.id), getI18n(langParam), logoUrl(b.id),
  ]);
  const viewer = await getStaff();
  const phone = phoneLabel(b.phone);
  return (
    <ClientShell phone={b.phone} phoneLabel={phone} website={b.website_url} bare={embed === "1"} i18n={{ lang, t }}
      brand={{ name: b.name, logo }} staffBack={viewer?.businessId === b.id ? "/settings/booking" : null}>
      {b.online_booking_enabled ? (
        <I18nProvider lang={lang} messages={messages}>
          <BookingWizard
            timezone={b.timezone}
            services={services}
            businessName={b.name}
            businessPhone={phone}
            today={todayYmd(b.timezone)}
            agreementTitle={agreement?.title ?? null}
            agreement={agreement?.required_online ? <AgreementText title={agreement.title} body={agreement.body} /> : null}
            initialPhone={typeof resumePhone === "string" ? resumePhone.replace(/\D/g, "").slice(-10) : ""}
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
