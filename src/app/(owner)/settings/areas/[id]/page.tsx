import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { serviceAreas } from "@/lib/booking";
import { zipInfo } from "@/lib/geo/zip";
import { Card, Page, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteAreaAction, saveAreaAction } from "../actions";
import { AreaForm } from "../area-form";

export const metadata: Metadata = { title: "Service area" };

export default async function AreaPage({ params }: PageProps<"/settings/areas/[id]">) {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const { id } = await params;
  const area = id === "new" ? null : (await serviceAreas(staff.businessId)).find((a) => a.id === id);
  if (id !== "new" && !area) notFound();
  // Shown as "San Mateo 94401, 94402, …" grouped by city, so it reads like what was typed.
  const byCity = new Map<string, string[]>();
  for (const z of area?.zip_codes ?? []) {
    const city = zipInfo(z)?.city ?? "";
    byCity.set(city, [...(byCity.get(city) ?? []), z]);
  }
  const places = [...byCity.values()].flat().join(", ");
  return (
    <>
      <PageHeader title={area?.name ?? t("New area")} back="/settings/areas" />
      <Page>
        <Card>
          <AreaForm action={saveAreaAction.bind(null, area?.id ?? null)}
            initial={area ? { name: area.name, color: area.color, weekdays: area.weekdays, places } : undefined} />
        </Card>
        {area && (
          <>
            <p className="px-1 text-sm text-muted">{[...byCity.keys()].filter(Boolean).join(", ")}</p>
            <form action={deleteAreaAction.bind(null, area.id)}>
              <ConfirmButton question={`Delete the ${area.name} area?`} className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-danger hover:bg-danger-soft">
                {t("Delete area")}
              </ConfirmButton>
            </form>
          </>
        )}
      </Page>
    </>
  );
}
