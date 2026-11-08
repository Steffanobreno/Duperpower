import Link from "next/link";
import type { Kpi } from "@/lib/data/kpis";
import { money } from "@/lib/format";
import { msg, type T } from "@/lib/i18n";

// The KPI panel's tiles: name, number and how it moved since the same days of last month.
// Plain markup (no chart, no client code); each tile is a group named by its label.

const LABELS: Record<Kpi["key"], string> = {
  revenue: msg("Revenue"),
  visits: msg("Visits done"),
  avg_ticket: msg("Average ticket"),
  return_rate: msg("Return rate"),
  occupancy: msg("Occupancy"),
  no_shows: msg("No-shows and cancellations"),
  overdue: msg("Overdue clients"),
  reports_sent: msg("Report cards sent"),
  offers_booked: msg("Invites that booked"),
};

function value(k: Kpi) {
  if (k.unit === "money") return money(k.value);
  if (k.unit === "percent") return `${k.value}%`;
  return String(k.value);
}

function change(k: Kpi, t: T) {
  if (k.previous == null) return null;
  if (k.previous > 0) {
    const pct = Math.round(((k.value - k.previous) / k.previous) * 100);
    return pct >= 0 ? t("▲ {n}% vs last month", { n: pct }) : t("▼ {n}% vs last month", { n: -pct });
  }
  return k.value > 0 ? t("new") : null;
}

export function KpiTiles({ kpis, t, today, labels = {} }: {
  kpis: Kpi[];
  t: T;
  /** The "overdue" tile opens Fill the gap for this day. */
  today: string;
  /** A different name for some tiles (Today's occupancy is the week's). */
  labels?: Partial<Record<Kpi["key"], string>>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {kpis.map((k) => {
        const label = t(labels[k.key] ?? LABELS[k.key]);
        const delta = change(k, t);
        const body = (
          <>
            <div className="text-xs font-semibold leading-tight text-muted">{label}</div>
            <div className="mt-0.5 text-lg font-extrabold tabular-nums">{value(k)}</div>
            {delta && <div className="text-xs text-muted">{delta}</div>}
          </>
        );
        return (
          <div key={k.key} role="group" aria-label={label} className="card min-w-0 px-3 py-2">
            {k.key === "overdue" ? <Link href={`/fill/${today}`} className="block">{body}</Link> : body}
          </div>
        );
      })}
    </div>
  );
}
