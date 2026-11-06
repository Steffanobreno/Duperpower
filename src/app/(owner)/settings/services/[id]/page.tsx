import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getService, listServices } from "@/lib/data/services";
import { Card, Page, PageHeader } from "@/components/ui";
import { saveServiceAction } from "../../actions";
import { ServiceForm } from "../../forms";

export const metadata: Metadata = { title: "Edit service" };

export default async function EditServicePage({ params }: PageProps<"/settings/services/[id]">) {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const { id } = await params;
  const [service, all] = await Promise.all([getService(staff, id), listServices(staff, { includeInactive: true })]);
  if (!service) notFound();
  const categories = [...new Set(all.map((s) => s.category).filter((c): c is string => !!c))];
  return (
    <>
      <PageHeader title={t("Edit service")} back="/settings/services" />
      <Page>
        <Card>
          <ServiceForm action={saveServiceAction.bind(null, id)} initial={service} categories={categories} />
        </Card>
        <p className="text-center text-xs text-muted">
          {t("Price changes apply to new bookings. Past and already booked visits keep their price.")}
        </p>
      </Page>
    </>
  );
}
