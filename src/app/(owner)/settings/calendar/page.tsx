import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { Card, Notice, Page, PageHeader } from "@/components/ui";
import { CopyField } from "@/components/copy-field";
import { googleCalendarScript } from "@/lib/google-calendar-script";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Google Calendar") };
}

export default async function CalendarSettingsPage() {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const [b] = await sql`select device_key, name, calendar_synced_at from businesses where id = ${staff.businessId}`;
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const feed = `${appUrl}/api/device/calendar?key=${b.device_key}`;
  const script = googleCalendarScript(`${feed}&format=json`, b.name, staff.timezone);
  return (
    <>
      <PageHeader title={t("Google Calendar")} back="/settings" />
      <Page>
        <Card className="space-y-3">
          <h2 className="font-bold">{t("Automatic, every 15 minutes (recommended)")}</h2>
          {b.calendar_synced_at ? (
            <Notice kind="success">
              {t("Connected. Last sync:")}{" "}
              {b.calendar_synced_at.toLocaleString("en-US", { timeZone: staff.timezone, dateStyle: "medium", timeStyle: "short" })}.
            </Notice>
          ) : (
            <Notice kind="warn">{t("Not connected yet. Follow the steps below once.")}</Notice>
          )}
          <p className="text-sm text-muted">
            {t("A small free script in your business Google account copies every visit (and every online request) into a \"{name}\" calendar: pets, services, phone and address. New, moved and cancelled visits show up within 15 minutes, from 6am to 9pm. Set it up once, on a computer.", { name: b.name })}
          </p>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            <li>{t("Open")}{" "} <strong>{t("script.google.com")}</strong> {" "}{t("signed in with your business Google account →")}{" "} <strong>{t("New project")}</strong>.</li>
            <li>{t("Delete what is in the editor and paste the script below (")}<strong>{t("Copy")}</strong>).</li>
            <li>{t("Press")}{" "} <strong>{t("Save")}</strong> {" "}{t("(disk icon). In the bar at the top choose")}{" "} <strong>{t("setup")}</strong>{t(", then")}{" "} <strong>{t("Run")}</strong>.</li>
            <li>
              {t("Google asks for permission:")}{" "} <strong>{t("Review permissions")}</strong> {" "}{t("→ your account →")}
              <strong> {" "}{t("Advanced → Go to Untitled project")}</strong> → <strong>{t("Allow")}</strong>{t(". It is your own script, so Google shows the \"not verified\" notice.")}
            </li>
            <li>{t("Open Google Calendar: the \"{name}\" calendar is there with your visits.", { name: b.name })}</li>
          </ol>
          <CopyField label={t("Script for script.google.com (keep it private: it has your calendar key)")} value={script} multiline />
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold">{t("Or subscribe with a link")}</h2>
          <p className="text-sm text-muted">
            {t("Simpler, but Google refreshes subscribed calendars only every few hours. On calendar.google.com →")}
            <strong> {" "}{t("Other calendars")}</strong> → <strong>+</strong> → <strong>{t("From URL")}</strong> {" "}{t("→ paste. On the iPhone: Settings → Apps → Calendar → Calendar Accounts → Add Account → Other → Add Subscribed Calendar.")}
          </p>
          <CopyField label={t("Your calendar link (keep it private)")} value={feed} />
        </Card>
        <Notice kind="warn">
          {t("Use one of the two, not both, and turn off the old app's Google Calendar sync when you stop using it, so visits don't show up twice.")}
        </Notice>
      </Page>
    </>
  );
}
