import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { calendarView } from "@/lib/data/calendar-view";
import { Card, Field, Input, Page, PageHeader, Select } from "@/components/ui";
import { SimpleForm } from "../forms";
import { saveCalendarViewAction } from "./actions";

export const metadata: Metadata = { title: "Calendar look" };

const SHOW = [
  ["show_client", "Client name"],
  ["show_pets", "Pet names"],
  ["show_services", "Services"],
  ["show_address", "Address"],
  ["show_notes", "Visit notes"],
] as const;

export default async function CalendarViewPage() {
  const staff = await requireStaff();
  const v = await calendarView(staff.businessId);
  return (
    <>
      <PageHeader title="Calendar look" back="/settings" />
      <Page>
        <Card>
          <SimpleForm action={saveCalendarViewAction}>
            <fieldset className="space-y-1">
              <legend className="mb-1 text-sm font-medium">Each visit on the calendar shows</legend>
              {SHOW.map(([name, label]) => (
                <label key={name} className="flex items-center justify-between gap-3 rounded-xl px-1 py-2">
                  <span>{label}</span>
                  <input type="checkbox" name={name} defaultChecked={v[name]} className="h-5 w-5" />
                </label>
              ))}
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Day view starts at" hint="Empty: your working hours.">
                <Input type="time" name="view_start" step={3600} defaultValue={v.view_start ?? ""} />
              </Field>
              <Field label="Day view ends at">
                <Input type="time" name="view_end" step={3600} defaultValue={v.view_end ?? ""} />
              </Field>
            </div>
            <Field label="Color the visits by">
              <Select name="color_by" defaultValue={v.color_by}>
                <option value="status">Status (confirmed green, not confirmed red…)</option>
                <option value="staff">Groomer</option>
                <option value="service">Service</option>
              </Select>
            </Field>
            <p className="text-xs text-muted">
              Groomer colors are set in <Link href="/settings/team" className="underline">Team</Link>; service colors in{" "}
              <Link href="/settings/services" className="underline">Services and prices</Link>. A visit with several services uses the first one&apos;s color.
            </p>
          </SimpleForm>
        </Card>
      </Page>
    </>
  );
}
