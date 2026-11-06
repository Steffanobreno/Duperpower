import { getOwnerI18n } from "@/lib/i18n/server";
import { DateField } from "@/components/date-field";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { listClosedDates } from "@/lib/data/closed";
import { todayYmd } from "@/lib/format";
import { HOLIDAYS } from "@/lib/holidays";
import { Card, Empty, Field, Input, Page, PageHeader } from "@/components/ui";
import { SimpleForm } from "../forms";
import { addClosedDatesAction, deleteClosedDatesAction, saveHolidaysAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Closed dates and holidays") };
}

const dateLabel = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function ClosedPage() {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const today = todayYmd(staff.timezone);
  const year = Number(today.slice(0, 4));
  const [dates, [b]] = await Promise.all([
    listClosedDates(staff.businessId),
    sql<{ closed_holidays: string[] }[]>`select closed_holidays from businesses where id = ${staff.businessId}`,
  ]);
  // The next time each holiday comes around: this year's, or next year's when it has passed.
  const next = HOLIDAYS.map((h) => ({ ...h, on: h.date(year) >= today ? h.date(year) : h.date(year + 1) }))
    .sort((x, y) => x.on.localeCompare(y.on));
  return (
    <>
      <PageHeader title={t("Closed dates and holidays")} back="/settings" />
      <Page>
        <p className="text-sm text-muted">
          {t("On these days clients can't book online, and the calendar shows the day as closed.")}
        </p>
        <section className="space-y-2">
          <h2 className="section-label">{t("Closed dates")}</h2>
          {dates.length ? (
            <ul className="card divide-y divide-line overflow-hidden">
              {dates.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {dateLabel(d.start_date)}
                      {d.end_date !== d.start_date && ` – ${dateLabel(d.end_date)}`}
                    </div>
                    <div className="text-sm text-muted">{d.reason || t("Closed")}{d.end_date < today && t(" · past")}</div>
                  </div>
                  <form action={deleteClosedDatesAction.bind(null, d.id)}>
                    <button type="submit" className="rounded-lg px-2 py-1 text-sm font-semibold text-danger hover:bg-danger-soft"
                      aria-label={t("Remove closed dates from {start_date}", { start_date: d.start_date })}>
                      {t("Remove")}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title={t("No closed dates")}>{t("Add your next vacation below.")}</Empty>
          )}
          <Card>
            <SimpleForm action={addClosedDatesAction} submitLabel={t("Add closed dates")} savedLabel={t("Added.")}>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("First day")}>
                  <DateField name="start_date" min={today} required />
                </Field>
                <Field label={t("Last day")}>
                  <DateField name="end_date" min={today} />
                </Field>
              </div>
              <Field label={t("Reason (optional)")} hint={t("Only you see it.")}>
                <Input name="reason" placeholder={t("Vacation")} maxLength={80} />
              </Field>
            </SimpleForm>
          </Card>
        </section>
        <section className="space-y-2">
          <h2 className="section-label">{t("Holidays {year}–", { year: year })}{year + 1}</h2>
          <Card>
            <SimpleForm action={saveHolidaysAction} submitLabel={t("Save holidays")} savedLabel={t("Holidays saved.")}>
              <p className="text-sm text-muted">{t("Turn off the holidays you don't work. They repeat every year.")}</p>
              <ul className="divide-y divide-line">
                {next.map((h) => (
                  <li key={h.key}>
                    <label className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{h.name}</span>
                        <span className="block text-xs text-muted">{dateLabel(h.on)}</span>
                      </span>
                      <span className="text-sm text-muted">{t("Closed")}</span>
                      <input type="checkbox" name={`closed:${h.key}`} defaultChecked={b.closed_holidays.includes(h.key)}
                        className="h-5 w-5" aria-label={t("Closed on {name}", { name: h.name })} />
                    </label>
                  </li>
                ))}
              </ul>
            </SimpleForm>
          </Card>
        </section>
      </Page>
    </>
  );
}
