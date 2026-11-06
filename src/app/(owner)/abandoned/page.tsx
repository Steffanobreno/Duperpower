import { msg, type T } from "@/lib/i18n";
import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { draftStats, listDrafts, STEP_NAMES, type DraftStatus } from "@/lib/data/abandoned";
import { dayLabel, money, timeLabel } from "@/lib/format";
import { Card, Empty, Page, PageHeader } from "@/components/ui";
import { setRecoveryAction } from "./recovery-actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Abandoned bookings") };
}

const STATUS: Record<DraftStatus, { label: string; className: string }> = {
  abandoned: { label: msg("Abandoned"), className: "text-danger" },
  contacted: { label: msg("Contacted"), className: "text-brand" },
  recovered: { label: msg("Recovered"), className: "text-success" },
};
const FILTERS: { key: DraftStatus | null; label: string }[] = [
  { key: null, label: msg("All") }, { key: "abandoned", label: msg("Abandoned") }, { key: "contacted", label: msg("Contacted") }, { key: "recovered", label: msg("Recovered") },
];
const ago = (d: Date, t: T) => {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? t("today") : days === 1 ? t("yesterday") : t("{n} days ago", { n: days });
};

export default async function AbandonedPage({ searchParams }: PageProps<"/abandoned">) {
  const { t } = await getOwnerI18n();
  const staff = await requireStaff();
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.status)?.key ?? null;
  const tz = staff.timezone;
  const [stats, list, [tpl]] = await Promise.all([
    draftStats(staff),
    listDrafts(staff, filter),
    sql<{ enabled: boolean; offset_minutes: number | null }[]>`
      select enabled, offset_minutes from message_templates where business_id = ${staff.businessId} and trigger = 'abandoned_booking'`,
  ]);
  const on = !!tpl?.enabled;
  return (
    <>
      <PageHeader title={t("Abandoned bookings")} />
      <Page>
        <form action={setRecoveryAction.bind(null, !on)} className="card flex items-center justify-between gap-3 px-4 py-3">
          <span>
            <span className="block font-semibold">{t("Recovery message")}</span>
            <span className="block text-xs text-muted">
              {on ? t("Sent {n}h after they stop (8am–8pm).", { n: Math.round((tpl?.offset_minutes ?? 120) / 60 * 10) / 10 }) : t("Off: nobody gets a message.")}{" "}
              <Link href="/settings/messages" className="underline">{t("Edit the text")}</Link>
            </span>
          </span>
          <button type="submit" role="switch" aria-checked={on} aria-label={t("Recovery message")}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-success" : "bg-line"}`}>
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </form>

        <Card className="space-y-2">
          <p className="text-sm text-muted">{t("Last 30 days")}</p>
          <div className="grid grid-cols-3 text-center">
            <div><div className="text-2xl font-bold">{stats.abandoned}</div><div className="text-xs text-muted">{t("Abandoned")}</div></div>
            <div><div className="text-2xl font-bold">{stats.recovered}</div><div className="text-xs text-muted">{t("Recovered")}</div></div>
            <div><div className="text-2xl font-bold">{money(stats.revenue)}</div><div className="text-xs text-muted">{t("Recovered rev.")}</div></div>
          </div>
        </Card>

        <nav aria-label={t("Filter")} className="-mx-1 flex gap-2 overflow-x-auto px-1">
          {FILTERS.map((f) => (
            <Link key={f.label} href={f.key ? `/abandoned?status=${f.key}` : "/abandoned"} aria-current={f.key === filter ? "true" : undefined}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${f.key === filter ? "border-navy bg-navy text-white" : "border-line bg-surface"}`}>
              {t(f.label)}
            </Link>
          ))}
        </nav>

        {list.length === 0 ? (
          <Empty title={filter ? t("Nothing here") : t("No abandoned bookings")}>
            {t("When someone starts booking on your site and stops, they show up here.")}
          </Empty>
        ) : (
          <ul className="space-y-2">
            {list.map((d) => (
              <li key={d.id}>
                <Link href={`/abandoned/${d.id}`} className="card block space-y-1 px-4 py-3 hover:bg-bg">
                  <span className="flex justify-between gap-2 text-sm text-muted">
                    <span>{dayLabel(d.updated_at, tz)} {timeLabel(d.updated_at, tz)}</span>
                    <span className={`font-semibold ${STATUS[d.status].className}`}>{t(STATUS[d.status].label)}</span>
                  </span>
                  <span className="block text-lg font-bold">{[d.first_name, d.last_name].filter(Boolean).join(" ") || t("Unknown name")}</span>
                  <span className="block text-sm text-muted">{t("Abandoned step:")}{" "} {t(STEP_NAMES[d.step] ?? d.step)}{d.pets ? ` · ${d.pets}` : ""}</span>
                  <span className="block text-sm text-muted">
                    {d.status === "recovered" ? t("Booked · {amount}", { amount: money(d.revenue_cents) })
                      : t("Last contact: {when}", { when: d.contacted_at ?? d.reminded_at ? ago((d.contacted_at ?? d.reminded_at)!, t) : "--" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Page>
    </>
  );
}
