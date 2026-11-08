import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { activeAgreement, countSigned, noShowFeeText } from "@/lib/agreement";
import { currencySymbol } from "@/lib/format";
import { Card, Field, Input, Page, PageHeader, Textarea } from "@/components/ui";
import { AgreementText } from "@/components/agreement-text";
import { saveAgreementAction } from "../actions";
import { SimpleForm } from "../forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Service agreement") };
}

export default async function AgreementPage() {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const agreement = await activeAgreement(staff.businessId);
  const signed = agreement ? await countSigned(agreement) : 0;
  return (
    <>
      <PageHeader title={t("Service agreement")} back="/settings" />
      <Page>
        <p className="text-sm text-muted">
          {t("Clients sign by typing their name: when they book online, and on their confirm link if they haven't signed in the last 12 months. To ask a client to sign without booking, use “Send to sign” on their profile.")}{" "}
          {agreement && (signed === 1 ? t("Version {version}: signed by 1 client.", { version: agreement.version }) : t("Version {version}: signed by {n} clients.", { version: agreement.version, n: signed }))}
        </p>
        <Card>
          <SimpleForm action={saveAgreementAction}>
            <Field label={t("Title")}>
              <Input name="title" defaultValue={agreement?.title ?? ""} required />
            </Field>
            <Field label={t("Text")} hint={t("Start a line with \"## \" for a heading and \"- \" for a bullet. Wrap words in ** for bold.")}>
              <Textarea name="body" rows={18} defaultValue={agreement?.body ?? ""} required />
            </Field>
            <Field label={`${t("No-show fee")} (${currencySymbol()})`} hint={t("Fills {no_show_fee} in the text. Left empty, the text says “a fee”.")}>
              <Input name="no_show_fee" inputMode="decimal"
                defaultValue={agreement?.no_show_fee_cents != null ? (agreement.no_show_fee_cents / 100).toFixed(2) : ""} />
            </Field>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" name="required_online" defaultChecked={agreement?.required_online ?? true} className="h-4 w-4" />
              {t("Clients must sign it to book online")}
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="sign_every_booking" defaultChecked={agreement?.sign_every_booking ?? false} className="mt-1 h-4 w-4" />
              <span>{t("Sign on every online booking (instead of once a year)")}</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="resign" className="mt-1 h-4 w-4" />
              <span>{t("This is an important change: ask every client to sign again")}</span>
            </label>
          </SimpleForm>
        </Card>
        {agreement && (
          <Card>
            <p className="mb-2 text-xs font-semibold uppercase text-muted">{t("Preview")}</p>
            <AgreementText title={agreement.title} body={agreement.body} noShowFee={noShowFeeText(agreement.no_show_fee_cents, t("a fee"))} />
          </Card>
        )}
      </Page>
    </>
  );
}
