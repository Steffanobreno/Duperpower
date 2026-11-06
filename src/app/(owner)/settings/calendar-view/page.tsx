import { msg } from "@/lib/i18n";
import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { calendarView } from "@/lib/data/calendar-view";
import { Card, Field, Input, Page, PageHeader, Select } from "@/components/ui";
import { SimpleForm } from "../forms";
import { saveCalendarViewAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Calendar look") };
}

const SHOW = [
  ["show_client", msg("Client name")],
  ["show_pets", msg("Pet names")],
  ["show_services", msg("Services")],
  ["show_address", msg("Address")],
  ["show_notes", msg("Visit notes")],
] as const;

export default async function CalendarViewPage() {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const v = await calendarView(staff.businessId);
  return (
    <>
      <PageHeader title={t("Calendar look")} back="/settings" />
      <Page>
        <Card>
          <SimpleForm action={saveCalendarViewAction}>
            <fieldset className="space-y-1">
              <legend className="mb-1 text-sm font-medium">{t("Each visit on the calendar shows")}</legend>
              {SHOW.map(([name, label]) => (
                <label key={name} className="flex items-center justify-between gap-3 rounded-xl px-1 py-2">
                  <span>{t(label)}</span>
                  <input type="checkbox" name={name} defaultChecked={v[name]} className="h-5 w-5" />
                </label>
              ))}
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Day view starts at")} hint={t("Empty: your working hours.")}>
                <Input type="time" name="view_start" step={3600} defaultValue={v.view_start ?? ""} />
              </Field>
              <Field label={t("Day view ends at")}>
                <Input type="time" name="view_end" step={3600} defaultValue={v.view_end ?? ""} />
              </Field>
            </div>
            <Field label={t("Color the visits by")}>
              <Select name="color_by" defaultValue={v.color_by}>
                <option value="status">{t("Status (confirmed green, not confirmed red…)")}</option>
                <option value="staff">{t("Groomer")}</option>
                <option value="service">{t("Service")}</option>
              </Select>
            </Field>
            <p className="text-xs text-muted">
              {t("Groomer colors are set in")}{" "} <Link href="/settings/team" className="underline">{t("Team")}</Link>{t("; service colors in")}{" "}
              <Link href="/settings/services" className="underline">{t("Services and prices")}</Link>{t(". A visit with several services uses the first one's color.")}
            </p>
          </SimpleForm>
        </Card>
      </Page>
    </>
  );
}
