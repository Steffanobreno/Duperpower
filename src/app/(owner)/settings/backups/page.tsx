import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { backupScript } from "@/lib/backup-script";
import { ButtonLink, Card, Notice, Page, PageHeader } from "@/components/ui";
import { CopyField } from "@/components/copy-field";

export const metadata: Metadata = { title: "Backups" };

export default async function BackupsPage() {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const [b] = await sql<{ backup_key: string; backup_at: Date | null; stale: boolean }[]>`
    select backup_key, backup_at, coalesce(backup_at < now() - interval '8 days', true) as stale
    from businesses where id = ${staff.businessId}`;
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const script = backupScript(`${appUrl}/api/device/backup?key=${b.backup_key}`, staff.timezone, staff.businessName);
  const when = b.backup_at?.toLocaleString("en-US", { timeZone: staff.timezone, dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      <PageHeader title={t("Backups")} back="/settings" />
      <Page>
        <Card className="space-y-3">
          <h2 className="font-bold">{t("Weekly backup to Google Drive")}</h2>
          {!b.backup_at ? (
            <Notice kind="warn">{t("Not set up yet. Follow the steps below once.")}</Notice>
          ) : b.stale ? (
            <Notice kind="warn">{t("The last backup was on {when}, more than a week ago. Check the script on script.google.com.", { when: when })}</Notice>
          ) : (
            <Notice kind="success">{t("Working. Last backup: {when}.", { when: when })}</Notice>
          )}
          <p className="text-sm text-muted">
            {t("Every Sunday night a free script in your business Google account saves a copy of everything (clients, pets, visits, payments, messages, settings) in a \"{businessName} backups\" folder on Google Drive, plus the client list as a spreadsheet. It keeps the last 12 weeks. This copy is separate from the app's database.", { businessName: staff.businessName })}
          </p>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            <li>{t("On the iPad or a computer, open")}{" "} <strong>{t("script.google.com")}</strong> {" "}{t("with your business Google account (on the iPad: Safari →")}{" "} <strong>{t("aA")}</strong> → <strong>{t("Request Desktop Website")}</strong>).</li>
            <li>{t("Tap")}{" "} <strong>{t("New project")}</strong>{t(". Use a new one, not the Google Calendar one.")}</li>
            <li>{t("Delete what is in the editor and paste the script below (")}<strong>{t("Copy")}</strong>).</li>
            <li>{t("Tap")}{" "} <strong>{t("Save")}</strong> {" "}{t("(disk icon). In the bar at the top choose")}{" "} <strong>{t("setup")}</strong>{t(", then")}{" "} <strong>{t("Run")}</strong>.</li>
            <li>{t("Google asks for permission:")}{" "} <strong>{t("Review permissions")}</strong> {" "}{t("→ your account →")}{" "} <strong>{t("Advanced → Go to Untitled project")}</strong> → <strong>{t("Allow")}</strong>.</li>
            <li>{t("Open")}{" "} <strong>{t("Google Drive")}</strong>{t(": the \"{businessName} backups\" folder has today's two files. Come back here: it says \"Working\".", { businessName: staff.businessName })}</li>
          </ol>
          <CopyField label={t("Backup script (keep it private: it has your key)")} value={script} multiline />
        </Card>
        <Card className="space-y-2">
          <h2 className="font-bold">{t("Download a copy now")}</h2>
          <p className="text-sm text-muted">{t("The same file the weekly backup saves, to keep wherever you like.")}</p>
          <div className="grid grid-cols-2 gap-2">
            <ButtonLink href="/api/export/backup" kind="secondary" prefetch={false}>{t("Everything (JSON)")}</ButtonLink>
            <ButtonLink href="/api/export/clients" kind="secondary" prefetch={false}>{t("Clients (spreadsheet)")}</ButtonLink>
          </div>
        </Card>
        <p className="px-1 text-xs text-muted">{t("Not in the backup: passwords, pet photos and drawn signatures (the typed name and date are kept).")}</p>
      </Page>
    </>
  );
}
