import { msg } from "@/lib/i18n";
import { getOwnerI18n } from "@/lib/i18n/server";
import type { Receipt } from "@/lib/data/receipts";
import { receiptUrl } from "@/lib/data/receipts";
import { dayLabel, timeLabel } from "@/lib/format";
import { Notice } from "@/components/ui";
import { ShareReceiptButton } from "@/components/share-receipt";

const RESULT: Record<string, string> = {
  sent: msg("Receipt emailed."),
  "no-email": msg("This client has no email on file. Add one on their profile, or send the receipt by text or WhatsApp."),
  "not-set-up": msg("Email isn't set up yet (Settings → Texts and email). Send it by text or WhatsApp for now."),
  failed: msg("The email didn't go out. Try again in a minute, or send it by text or WhatsApp."),
};

/** Ways to get a receipt to the client: share the PDF, text or WhatsApp the link, email it, download it. */
export async function ReceiptActions({ r, emailAction, result }: {
  r: Receipt;
  emailAction: () => Promise<void>;
  result?: string; // ?receipt= after "Email receipt"
}) {
  const { t } = await getOwnerI18n();
  const tz = r.business.timezone;
  const text = t("Here's your receipt from {name}. Thank you! {receiptUrl}", { name: r.business.name, receiptUrl: receiptUrl(r.token) });
  const phoneDigits = r.client.phone?.replace(/\D/g, "") ?? "";
  return (
    <section className="space-y-2" aria-label={t("Receipt")}>
      <h2 className="section-label px-1">{t("Receipt #{number}", { number: r.number })}</h2>
      {result && RESULT[result] && <Notice kind={result === "sent" ? "success" : "warn"}>{t(RESULT[result])}</Notice>}
      <div className="card space-y-3 p-4">
        <p className="text-sm text-muted">
          {r.emailedAt
            ? t("Emailed to {email} on {day} {time}.", { email: r.client.email, day: dayLabel(r.emailedAt, tz), time: timeLabel(r.emailedAt, tz) })
            : r.client.email
              // The receipt goes out right after the payment, in the background.
              ? (r.justClosed ? t("Sending to {email}…", { email: r.client.email }) : t("Not emailed yet."))
              : t("No email on file for this client: send it by text or WhatsApp.")}
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm font-bold">
          <ShareReceiptButton pdfUrl={`/r/${r.token}/pdf`} fileName={`woofers-receipt-${r.number}.pdf`}
            className="col-span-2 rounded-full bg-brand py-3 text-white">
            {t("Share PDF (Messages, WhatsApp…)")}
          </ShareReceiptButton>
          {r.client.phone && (
            <a href={`sms:${r.client.phone}&body=${encodeURIComponent(text)}`} className="rounded-full border-2 border-brand py-2.5 text-center text-brand">
              {t("Text the link")}
            </a>
          )}
          {r.client.phone && (
            <a href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"
              className="rounded-full border-2 border-[#1f8a4c] py-2.5 text-center text-[#1f8a4c]">
              {t("WhatsApp")}
            </a>
          )}
          <form action={emailAction} className="contents">
            <button type="submit" className="rounded-full border-2 border-brand py-2.5 text-brand">
              {r.emailedAt ? t("Email again") : t("Email receipt")}
            </button>
          </form>
          <a href={`/r/${r.token}/pdf?download=1`} className="rounded-full border-2 border-line py-2.5 text-center">{t("Download PDF")}</a>
        </div>
        <a href={`/r/${r.token}`} target="_blank" rel="noreferrer" className="block text-center text-sm font-semibold text-brand">
          {t("See the client's receipt page")}
        </a>
      </div>
    </section>
  );
}
