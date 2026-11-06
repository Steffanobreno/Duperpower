import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { listServices } from "@/lib/data/services";
import { Card, Page, PageHeader } from "@/components/ui";
import { saveServiceAction } from "../../actions";
import { ServiceForm } from "../../forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("New service") };
}

export default async function NewServicePage() {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const categories = [...new Set((await listServices(staff, { includeInactive: true })).map((s) => s.category).filter((c): c is string => !!c))];
  return (
    <>
      <PageHeader title={t("New service")} back="/settings/services" />
      <Page>
        <Card>
          <ServiceForm action={saveServiceAction.bind(null, null)} categories={categories} />
        </Card>
      </Page>
    </>
  );
}
