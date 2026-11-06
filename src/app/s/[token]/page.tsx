import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { activeAgreement, currentSignature } from "@/lib/agreement";
import { logoUrl } from "@/lib/business-logo";
import { getStaff } from "@/lib/auth";
import { regionForPage } from "@/lib/region-server";
import { phoneLabel } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { AgreementText } from "@/components/agreement-text";
import { ClientShell, StepCard } from "@/components/client-shell";
import { Button, Field, Input, Notice } from "@/components/ui";
import { signByTokenAction } from "./actions";

export const metadata: Metadata = { title: "Service agreement", robots: { index: false } };

// The link the owner sends so a client signs the service agreement without booking.
export default async function SignPage({ params, searchParams }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f]{24}$/.test(token)) notFound();
  const [c] = await sql<{ id: string; first_name: string; business_id: string; business: string; phone: string | null; website_url: string | null; country: string; currency: string }[]>`
    select c.id, c.first_name, c.business_id, b.name as business, b.phone, b.website_url, b.country, b.currency
    from clients c join businesses b on b.id = c.business_id where c.sign_token = ${token}`;
  if (!c) notFound();
  const [{ lang, t }, agreement, logo] = await Promise.all([getI18n(sp.lang), activeAgreement(c.business_id), logoUrl(c.business_id)]);
  if (!agreement) notFound();
  const [signed, viewer] = await Promise.all([currentSignature(agreement, c.id), getStaff()]);
  regionForPage(c, lang);
  return (
    <ClientShell phone={c.phone} phoneLabel={phoneLabel(c.phone)} website={c.website_url} i18n={{ lang, t }} brand={{ name: c.business, logo }}
      staffBack={viewer?.businessId === c.business_id ? `/clients/${c.id}` : null}>
      <StepCard className="space-y-4">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{t("Hi {name}!", { name: c.first_name })}</h1>
        {signed && !agreement.sign_every_booking ? (
          <Notice kind="success">{t("Thank you! You signed the service agreement.")}</Notice>
        ) : (
          <form action={signByTokenAction.bind(null, token)} className="space-y-3">
            {sp.needSign && <Notice kind="error">{t("Please tick the box and type your full name to sign.")}</Notice>}
            <p className="text-sm font-medium">{t("Please read and sign our service agreement.")}</p>
            <div className="max-h-96 overflow-y-auto rounded-xl border border-line bg-bg p-3" tabIndex={0} aria-label={t("Service agreement")}>
              <AgreementText title={agreement.title} body={agreement.body} />
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="agree" required className="mt-1 h-4 w-4" />
              <span>{t("I have read and agree to the service agreement.")}</span>
            </label>
            <Field label={t("Type your full name to sign")}>
              <Input name="signature" required minLength={3} autoComplete="name" />
            </Field>
            <Button type="submit" className="w-full rounded-full py-4 text-lg">{t("Sign agreement")}</Button>
          </form>
        )}
        {sp.signed && signed && agreement.sign_every_booking && <Notice kind="success">{t("Thank you! You signed the service agreement.")}</Notice>}
      </StepCard>
    </ClientShell>
  );
}
