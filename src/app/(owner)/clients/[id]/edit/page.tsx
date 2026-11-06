import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { allOptions, clientTagsFor } from "@/lib/data/options";
import { clientOptions } from "../../options";
import { getClient } from "@/lib/data/clients";
import { phoneLabel } from "@/lib/format";
import { Card, Page, PageHeader } from "@/components/ui";
import { updateClientAction } from "../../actions";
import { ClientForm } from "../../forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Edit client") };
}

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  const { t } = await getOwnerI18n();
  const staff = await requireStaff();
  const { id } = await params;
  const [client, lists, tags] = await Promise.all([getClient(staff, id), allOptions(staff.businessId), clientTagsFor([id])]);
  if (!client) notFound();
  return (
    <>
      <PageHeader title={t("Edit client")} back={`/clients/${id}`} />
      <Page>
        <Card>
          <ClientForm
            action={updateClientAction.bind(null, id)}
            submitLabel={t("Save changes")}
            options={clientOptions(lists)}
            initial={{ ...client, phone: phoneLabel(client.phone), sms_consent: client.sms_consent_at != null, tags: tags.get(id) ?? [] }}
          />
        </Card>
      </Page>
    </>
  );
}
