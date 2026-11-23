import { msg } from "@/lib/i18n";
import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "@/components/app-link";
import { requirePermission } from "@/lib/auth";
import { pendingBefore, pendingIn, type PendingVisit } from "@/lib/data/pending";
import { addDaysYmd, dayLabel, dayRangeUtc, isRealYmd, money, timeLabel, todayYmd, weekdayOf, ymd } from "@/lib/format";
import { Card, Empty, Page, PageHeader } from "@/components/ui";
import { setStatusAction } from "../appointments/actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Pending") };
}

type View = "day" | "week" | "month";
const VIEWS: { key: View; label: string }[] = [
  { key: "day", label: msg("Day") }, { key: "week", label: msg("Week") }, { key: "month", label: msg("Month") },
];
const monday = (d: string) => addDaysYmd(d, -((weekdayOf(d) + 6) % 7));
const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
const nextMonth = (d: string) => {
  const [y, m] = d.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
};
const prevMonth = (d: string) => {
  const [y, m] = d.split("-").map(Number);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
};

/** The period holding `date`: its first day, the day after its last, and its neighbours' first days. */
function period(view: View, date: string) {
  if (view === "day") return { first: date, after: addDaysYmd(date, 1), prev: addDaysYmd(date, -1), next: addDaysYmd(date, 1) };
  if (view === "week") {
    const first = monday(date);
    return { first, after: addDaysYmd(first, 7), prev: addDaysYmd(first, -7), next: addDaysYmd(first, 7) };
  }
  const first = monthStart(date);
  return { first, after: nextMonth(first), prev: prevMonth(first), next: nextMonth(first) };
}

const noon = (d: string) => new Date(`${d}T12:00:00Z`);

export default async function PendingPage({ searchParams }: PageProps<"/pending">) {
  const { t, locale } = await getOwnerI18n();
  const staff = await requirePermission("payments");
  const tz = staff.timezone;
  const sp = await searchParams;
  const view: View = VIEWS.some((v) => v.key === sp.view) ? (sp.view as View) : "week";
  const date = isRealYmd(sp.date) ? sp.date : todayYmd(tz);
  const p = period(view, date);
  const from = dayRangeUtc(p.first, tz).start;
  const to = dayRangeUtc(p.after, tz).start;
  const [list, before] = await Promise.all([pendingIn(staff, from, to), pendingBefore(staff, from)]);
  const close = list.filter((v) => v.kind === "close");
  const collect = list.filter((v) => v.kind === "collect");
  const href = (v: View, d: string) => `/pending?view=${v}&date=${d}`;

  const title = view === "day"
    ? noon(p.first).toLocaleDateString(locale, { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" })
    : view === "week"
      ? `${noon(p.first).toLocaleDateString(locale, { timeZone: "UTC", month: "short", day: "numeric" })} – ${noon(addDaysYmd(p.after, -1)).toLocaleDateString(locale, { timeZone: "UTC", month: "short", day: "numeric" })}`
      : noon(p.first).toLocaleDateString(locale, { timeZone: "UTC", month: "long", year: "numeric" });

  const group = (name: string, hint: string, visits: PendingVisit[], action: (v: PendingVisit) => ReactNode) => (
    <section aria-label={name} className="space-y-2">
      <h2 className="flex items-baseline justify-between gap-2 px-1">
        <span className="text-lg font-bold">{name} ({visits.length})</span>
        <span className="text-sm font-semibold text-muted">{money(visits.reduce((s, v) => s + v.price_cents, 0))}</span>
      </h2>
      <p className="px-1 text-xs text-muted">{hint}</p>
      {visits.length === 0 ? (
        <p className="card px-4 py-3 text-sm text-muted">{t("Nothing here")}</p>
      ) : (
        <ul className="space-y-2">
          {visits.map((v) => (
            <li key={v.id} className="card flex items-center justify-between gap-3 px-4 py-3">
              <Link href={`/appointments/${v.id}`} className="min-w-0 flex-1">
                <span className="block text-sm text-muted">{dayLabel(v.start_at, tz)} · {timeLabel(v.start_at, tz)}</span>
                <span className="block truncate font-bold">{v.client}</span>
                <span className="block truncate text-sm text-muted">{[v.pets, money(v.price_cents)].filter(Boolean).join(" · ")}</span>
              </Link>
              {action(v)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <>
      <PageHeader title={t("Pending")} />
      <Page>
        <nav aria-label={t("Period")} className="flex gap-2">
          {VIEWS.map((v) => (
            <Link key={v.key} href={href(v.key, date)} aria-current={v.key === view ? "true" : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${v.key === view ? "border-navy bg-navy text-white" : "border-line bg-surface"}`}>
              {t(v.label)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-2">
          <Link href={href(view, p.prev)} aria-label={t("Previous")} className="rounded-xl border border-line px-3 py-2 text-lg font-bold">‹</Link>
          <span className="text-center font-bold">{title}</span>
          <Link href={href(view, p.next)} aria-label={t("Next")} className="rounded-xl border border-line px-3 py-2 text-lg font-bold">›</Link>
        </div>

        {before.n > 0 && before.oldest && (
          <Link href={href(view, ymd(before.oldest, tz))} className="card block px-4 py-3 text-sm font-semibold text-danger">
            {t("{n} more before this. Go to the oldest ›", { n: before.n })}
          </Link>
        )}

        {list.length === 0 && before.n === 0 ? (
          <Empty title={t("All closed")}>{t("Every visit in this period is marked done and paid.")}</Empty>
        ) : (
          <>
            {group(t("To close"), t("Over, but not marked done."), close, (v) => (
              <form action={setStatusAction.bind(null, v.id, "completed")}>
                <button type="submit" className="shrink-0 rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-white">{t("Mark done")}</button>
              </form>
            ))}
            {group(t("To collect"), t("Done, but no payment recorded."), collect, (v) => (
              <Link href={`/appointments/${v.id}/checkout`} className="shrink-0 rounded-xl bg-success px-3 py-2 text-sm font-semibold text-white">
                {t("Take payment")}
              </Link>
            ))}
          </>
        )}
        <Card className="text-xs text-muted">
          {t("Counts from the first payment you closed in the app. Older visits came from your previous app.")}
        </Card>
      </Page>
    </>
  );
}
