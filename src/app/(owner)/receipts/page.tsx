import { getOwnerI18n } from "@/lib/i18n/server";
import { DateField } from "@/components/date-field";
import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { listReceipts } from "@/lib/data/receipts";
import { addDaysYmd, dayLabel, isYmd, money, todayYmd, zonedToUtc } from "@/lib/format";
import { ButtonLink, Empty, Page, PageHeader } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Receipts") };
}

// Every paid receipt in a period: open one, or download them all as one PDF.
export default async function ReceiptsPage({ searchParams }: PageProps<"/receipts">) {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("payments");
  const sp = await searchParams;
  const today = todayYmd(staff.timezone);
  const from = isYmd(sp.from) ? sp.from : `${today.slice(0, 7)}-01`;
  const to = isYmd(sp.to) && sp.to >= from ? sp.to : today;
  const list = await listReceipts(staff.businessId, zonedToUtc(from, "00:00", staff.timezone), zonedToUtc(addDaysYmd(to, 1), "00:00", staff.timezone));
  const total = list.reduce((s, r) => s + r.total_cents, 0);
  return (
    <>
      <PageHeader title={t("Receipts")} action={<ButtonLink href="/receipts/new">{t("New receipt")}</ButtonLink>} />
      <Page>
        <form className="card grid grid-cols-[1fr_1fr_auto] items-end gap-2 p-3">
          <label className="text-xs font-semibold text-muted">{t("From")}<DateField name="from" defaultValue={from} /></label>
          <label className="text-xs font-semibold text-muted">{t("To")}<DateField name="to" defaultValue={to} /></label>
          <button type="submit" className="rounded-xl bg-navy px-4 py-2.5 font-semibold text-white">{t("Show")}</button>
        </form>
        <div className="flex items-center justify-between px-1 text-sm">
          <span className="font-semibold">{t("{n} receipt", { n: list.length })}{list.length === 1 ? "" : "s"} · {money(total)}</span>
          {list.length > 0 && (
            <a href={`/receipts/pdf?from=${from}&to=${to}`} className="rounded-full bg-brand px-4 py-2 font-bold text-white">
              {t("Download all (PDF)")}
            </a>
          )}
        </div>
        {list.length === 0 ? (
          <Empty title={t("No receipts in these days")}>{t("Finished orders and receipts you write show here.")}</Empty>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {[...list].reverse().map((r) => (
              <li key={r.id}>
                <Link href={r.appointment_id ? `/appointments/${r.appointment_id}/checkout` : `/receipts/${r.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
                  <span className="w-14 shrink-0 text-sm font-bold text-muted">#{r.receipt_no}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.client}</span>
                    <span className="block text-xs text-muted">{dayLabel(r.closed_at, staff.timezone)}{r.appointment_id ? "" : t(" · written by hand")}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{money(r.total_cents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Page>
    </>
  );
}
