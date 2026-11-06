import { getOwnerI18n } from "@/lib/i18n/server";
import Link from "next/link";
import type { StaffContext } from "@/lib/auth";
import { listRange } from "@/lib/data/appointments";
import { listTimeOff } from "@/lib/data/time-off";
import { closedDays } from "@/lib/data/closed";
import { sql } from "@/lib/db";
import { addDaysYmd, dayRangeUtc, hm, longDayLabel, timeLabel, todayYmd, weekdayOf, ymd, zonedToUtc } from "@/lib/format";
import { MonthStrip, WeekStrip, monthGridStart, shiftMonth } from "@/components/week-strip";

// Rescheduling inside the visit: the groomer's week (swipe or arrows; ▾ opens the month) with a
// dot per visit, and for the chosen day its visits and the free times this visit fits in.
// Tapping a free time asks to confirm the move (the ?move=1 card at the top of the page).

const HIDDEN = ["cancelled", "no_show", "declined"];
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export async function ReschedulePlanner({ staff, appt, day, monthOpen }: {
  staff: StaffContext;
  appt: { id: string; staff_id: string; start_at: Date; end_at: Date; client: string };
  /** The day being looked at (the visit's day by default). */
  day: string;
  monthOpen: boolean;
}) {
  const { t: tr } = await getOwnerI18n();
  const tz = staff.timezone;
  const today = todayYmd(tz);
  const minutes = Math.round((appt.end_at.getTime() - appt.start_at.getTime()) / 60000);
  const from = monthOpen ? monthGridStart(day) : addDaysYmd(day, -weekdayOf(day));
  const count = monthOpen ? 42 : 7;
  const [all, blocks, hours, closed] = await Promise.all([
    listRange(staff, from, count),
    listTimeOff(staff, from, count, appt.staff_id),
    sql<{ weekday: number; start: string; end: string }[]>`
      select weekday, to_char(start_time, 'HH24:MI') as start, to_char(end_time, 'HH24:MI') as end
      from working_hours where staff_id = ${appt.staff_id}`,
    closedDays(staff.businessId, from, addDaysYmd(from, count - 1)),
  ]);
  const visits = all.filter((a) => a.staff_id === appt.staff_id && !HIDDEN.includes(a.status));
  const onDay = (d: string) => visits.filter((a) => ymd(a.start_at, tz) === d);
  const href = (d: string, month = monthOpen) => `/appointments/${appt.id}?rs=${d}${month ? "&rsm=1" : ""}#reschedule`;

  // Free start times on the chosen day, every 30 minutes, where the whole visit fits.
  const list = onDay(day).sort((a, b) => a.start_at.getTime() - b.start_at.getTime());
  const h = hours.find((x) => x.weekday === weekdayOf(day));
  const { start: dayStart, end: dayEnd } = dayRangeUtc(day, tz);
  const busy = [
    ...list.filter((a) => a.id !== appt.id).map((a) => [a.start_at, a.end_at] as const),
    ...blocks.filter((b) => b.start_at < dayEnd && b.end_at > dayStart).map((b) => [b.start_at, b.end_at] as const),
  ].map(([s, e]) => [s <= dayStart ? 0 : toMin(hm(s, tz)), e >= dayEnd ? 1440 : toMin(hm(e, tz))] as const);
  const now = day === today ? toMin(hm(new Date(), tz)) : -1;
  const free: string[] = [];
  if (h && !closed.has(day) && day >= today) {
    for (let t = Math.ceil(toMin(h.start) / 30) * 30; t + minutes <= toMin(h.end); t += 30) {
      if (t <= now) continue;
      if (busy.some(([s, e]) => t < e && t + minutes > s)) continue;
      free.push(hhmm(t));
    }
  }
  const length = minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ""}` : `${minutes}min`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        <Link href={href(monthOpen ? shiftMonth(day, -1) : addDaysYmd(day, -7))} scroll={false}
          aria-label={monthOpen ? tr("Previous month") : tr("Previous week")} className="rounded-full px-3 py-1 text-2xl leading-none text-brand">‹</Link>
        <Link href={href(day, !monthOpen)} scroll={false} aria-expanded={monthOpen}
          aria-label={monthOpen ? tr("Show one week") : tr("Show the whole month")}
          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 font-bold">
          <span className="truncate">
            {new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
          </span>
          <span aria-hidden className="text-brand">{monthOpen ? "▴" : "▾"}</span>
        </Link>
        <Link href={href(monthOpen ? shiftMonth(day, 1) : addDaysYmd(day, 7))} scroll={false}
          aria-label={monthOpen ? tr("Next month") : tr("Next week")} className="rounded-full px-3 py-1 text-2xl leading-none text-brand">›</Link>
      </div>
      {monthOpen ? (
        <MonthStrip date={day} today={today} dots={(d) => onDay(d).length} href={(d) => href(d)}
          monthHref={(n) => href(shiftMonth(day, n))} />
      ) : (
        <WeekStrip date={day} today={today} dots={(d) => onDay(d).length} href={(d) => href(d)} />
      )}

      <section aria-label={tr("Chosen day")} className="space-y-2 border-t border-line pt-3">
        <p className="font-bold">{longDayLabel(zonedToUtc(day, "12:00", tz), tz)}</p>
        {closed.has(day) ? (
          <p className="text-sm text-warn">{tr("Closed · {get}", { get: closed.get(day) })}</p>
        ) : !h ? (
          <p className="text-sm text-muted">{tr("Day off")}</p>
        ) : null}
        {list.length > 0 ? (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line text-sm">
            {list.map((a) => (
              <li key={a.id}>
                <Link href={`/appointments/${a.id}`}
                  className={`flex items-center gap-3 px-3 py-2 ${a.id === appt.id ? "bg-brand-soft" : ""}`}>
                  <span className="shrink-0 whitespace-nowrap font-semibold">{timeLabel(a.start_at, tz)} – {timeLabel(a.end_at, tz)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {a.id === appt.id ? <strong>{tr("This visit")}</strong> : a.client_name}
                    {a.city && <span className="text-muted"> · {a.city}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : h && !closed.has(day) ? (
          <p className="text-sm text-muted">{tr("No visits yet this day.")}</p>
        ) : null}
        {free.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">{tr("Free for {n} · tap to move {client} there", { n: length, client: appt.client })}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {free.map((t) => (
                <Link key={t} href={`/appointments/${appt.id}?move=1&date=${day}&time=${t}`}
                  className="whitespace-nowrap rounded-full border border-brand py-1.5 text-center text-[13px] font-bold text-brand hover:bg-brand-soft">
                  {timeLabel(zonedToUtc(day, t, tz), tz).replace(" ", "\u00a0")}
                </Link>
              ))}
            </div>
          </div>
        )}
        {h && !closed.has(day) && day >= today && free.length === 0 && (
          <p className="text-sm text-muted">{tr("No free time for {n} this day.", { n: length })}</p>
        )}
      </section>
    </div>
  );
}
