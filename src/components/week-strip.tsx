import Link from "next/link";
import { addDaysYmd } from "@/lib/format";
import { Swipe } from "./swipe";

const fmt = (d: string, o: Intl.DateTimeFormatOptions) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...o });

/**
 * A week, Sunday to Saturday, with a dot per visit. Tap a day to open it; swipe sideways for
 * the week before or after. `href` builds the link for a day.
 */
export function WeekStrip({ date, today, href, dots }: {
  date: string; today: string; href: (day: string) => string; dots: (day: string) => number;
}) {
  const sunday = addDaysYmd(date, -new Date(`${date}T12:00:00Z`).getUTCDay());
  return (
    <Swipe prev={href(addDaysYmd(date, -7))} next={href(addDaysYmd(date, 7))} className="grid grid-cols-7 text-center">
      {Array.from({ length: 7 }, (_, i) => addDaysYmd(sunday, i)).map((d) => {
        const n = dots(d);
        return (
          <Link key={d} href={href(d)} aria-current={d === date ? "date" : undefined}
            aria-label={`${fmt(d, { weekday: "long", month: "long", day: "numeric" })}${n ? `, ${n} visit${n > 1 ? "s" : ""}` : ""}`}
            className="flex flex-col items-center gap-1 py-1">
            <span className="text-xs font-semibold text-muted">{fmt(d, { weekday: "narrow" })}</span>
            <span className={`flex h-9 w-9 items-center justify-center rounded-full font-semibold ${
              d === date ? "bg-brand text-white" : d === today ? "ring-2 ring-brand text-brand" : ""}`}>
              {Number(d.slice(8))}
            </span>
            <span aria-hidden className="flex h-1.5 gap-0.5">
              {Array.from({ length: Math.min(n, 3) }, (_, k) => <span key={k} className="h-1.5 w-1.5 rounded-full bg-success" />)}
            </span>
          </Link>
        );
      })}
    </Swipe>
  );
}
