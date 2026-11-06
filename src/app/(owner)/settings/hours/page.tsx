import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { Card, Page, PageHeader } from "@/components/ui";
import { saveHoursAction } from "../actions";
import { HoursForm } from "../forms";

export const metadata: Metadata = { title: "Working hours" };

export default async function HoursPage() {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const rows = await sql<{ weekday: number; start: string; end: string }[]>`
    select weekday, to_char(start_time, 'HH24:MI') as start, to_char(end_time, 'HH24:MI') as end
    from working_hours where staff_id = ${staff.staffId} order by weekday`;
  return (
    <>
      <PageHeader title={t("Working hours")} back="/settings" />
      <Page>
        <Card>
          <HoursForm action={saveHoursAction} hours={rows} />
        </Card>
      </Page>
    </>
  );
}
