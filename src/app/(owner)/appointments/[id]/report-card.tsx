import Link from "next/link";
import type { StaffContext } from "@/lib/auth";
import { sql } from "@/lib/db";
import { dayLabel, timeLabel } from "@/lib/format";
import { ensureReportToken, reportHasContent, reportUrl } from "@/lib/data/report-card";
import { SendFromPhone } from "@/components/send-from-phone";
import { EmailReportButton } from "./email-report-button";
import { RecordReportSent } from "./record-report-sent";

/** The pet's report card on the visit: preview it, email the link, or send it from the groomer's phone. */
export async function ReportCardSection({ staff, appointmentId, clientId, petNames, t }: {
  staff: StaffContext;
  appointmentId: string;
  clientId: string;
  petNames: string[];
  t: (s: string, vars?: Record<string, string | number>) => string;
}) {
  const [hasContent, [row]] = await Promise.all([
    reportHasContent(staff.businessId, appointmentId),
    sql<{ first_name: string; phone: string; email: string | null; sms_opted_out_at: Date | null; sent_at: Date | null }[]>`
      select c.first_name, c.phone, c.email, c.sms_opted_out_at, a.report_sent_at as sent_at
      from appointments a join clients c on c.id = a.client_id
      where a.id = ${appointmentId} and a.business_id = ${staff.businessId} and c.id = ${clientId}`,
  ]);
  if (!row) return null;
  const title = t("Report card");
  if (!hasContent) {
    return (
      <section className="space-y-2" aria-label={title}>
        <h2 className="section-label">{title}</h2>
        <div className="card p-4 text-sm text-muted">{t("Add a photo, note or tag first.")}</div>
      </section>
    );
  }
  const token = await ensureReportToken(staff.businessId, appointmentId);
  const text = t("{client}, here is {pet}'s report card: {link}", { client: row.first_name, pet: petNames.join(" & "), link: reportUrl(token) });
  const canEmail = staff.can.client_contact;
  const noEmail = !row.email ? t("This client has no email.") : null;
  return (
    <section className="space-y-2" aria-label={title}>
      <h2 className="section-label">{title}</h2>
      <div className="card space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2 text-sm font-bold">
          <Link href={`/g/${token}`} target="_blank" className="col-span-2 rounded-full bg-brand py-3 text-center text-white">{t("Preview")}</Link>
          {canEmail && (
            <EmailReportButton appointmentId={appointmentId} label={t("Send by email")} disabledReason={noEmail}
              errors={{ "This client has no email.": t("This client has no email."), "Add a photo, note or tag first.": t("Add a photo, note or tag first.") }} />
          )}
          {canEmail ? (
            <RecordReportSent appointmentId={appointmentId}>
              <SendFromPhone phone={row.phone} text={text} smsAllowed={!row.sms_opted_out_at} t={t} />
            </RecordReportSent>
          ) : (
            <SendFromPhone phone={row.phone} text={text} smsAllowed={!row.sms_opted_out_at} t={t} />
          )}
        </div>
        {row.sent_at && (
          <p className="text-sm text-muted">
            {t("Sent {when}", { when: `${dayLabel(row.sent_at, staff.timezone)} ${timeLabel(row.sent_at, staff.timezone)}` })}
          </p>
        )}
      </div>
    </section>
  );
}
