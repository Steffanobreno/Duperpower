import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { allOptions } from "@/lib/data/options";
import { clientOptions } from "../options";
import { Card, Page, PageHeader } from "@/components/ui";
import { createClientAction } from "../actions";
import { ClientForm } from "../forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("New client") };
}

export default async function NewClientPage() {
  const { t } = await getOwnerI18n();
  const staff = await requireStaff();
  const lists = await allOptions(staff.businessId);
  return (
    <>
      <PageHeader title={t("New client")} back="/clients" />
      <Page>
        <Card>
          <ClientForm action={createClientAction} submitLabel={t("Save and add a pet")} options={clientOptions(lists)} />
        </Card>
      </Page>
    </>
  );
}
