import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { fullName, getClient } from "@/lib/data/clients";
import { todayYmd } from "@/lib/format";
import { Card, Field, Input, Page, PageHeader } from "@/components/ui";
import { DateField } from "@/components/date-field";
import { SimpleForm } from "../../settings/forms";
import { addToWaitlistAction } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Add to waitlist") };
}

export default async function NewWaitlistPage({ searchParams }: PageProps<"/waitlist/new">) {
  const { t } = await getOwnerI18n();
  const staff = await requireStaff();
  const sp = await searchParams;
  const client = typeof sp.client === "string" ? await getClient(staff, sp.client) : null;
  if (!client) notFound();
  const today = todayYmd(staff.timezone);
  return (
    <>
      <PageHeader title={t("Add to waitlist")} back={`/clients/${client.id}`} />
      <Page>
        <p className="px-1 text-sm text-muted">
          <strong className="text-ink">{fullName(client)}</strong> {" "}{t("wants a day that's full. If a visit on one of these days is cancelled, Today and the Waitlist tell you, with buttons to text or book them.")}
        </p>
        <Card>
          <SimpleForm action={addToWaitlistAction.bind(null, client.id)} submitLabel={t("Add to waitlist")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("First day")}><DateField name="from_date" min={today} required /></Field>
              <Field label={t("Last day (optional)")}><DateField name="to_date" min={today} /></Field>
            </div>
            <Field label={t("Note (optional)")} hint={t("Morning only, any groomer…")}>
              <Input name="note" maxLength={300} placeholder={t("Mornings only")} />
            </Field>
          </SimpleForm>
        </Card>
      </Page>
    </>
  );
}
