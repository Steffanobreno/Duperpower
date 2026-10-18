import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { listRange } from "@/lib/data/appointments";
import { sql } from "@/lib/db";
import { addDaysYmd, dayLabel, isYmd, money, timeLabel, todayYmd, weekdayOf, ymd, zonedToUtc } from "@/lib/format";
import { ButtonLink, Page, PageHeader, StatusBadge } from "@/components/ui";
import { DayNav } from "@/components/day-nav";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const tz = staff.timezone;
  const today = todayYmd(tz);
  const picked = isYmd(sp.date) ? sp.date : today;
  // Weeks start on Monday.
  const monday = addDaysYmd(picked, -((weekdayOf(picked) + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(monday, i));
  const [appts, hours] = await Promise.all([
    listRange(staff, monday, 7),
    sql<{ weekday: number }[]>`select distinct weekday from working_hours where staff_id = ${staff.staffId}`,
  ]);
  const workDays = new Set(hours.map((h) => h.weekday));
  const noon = (d: string) => zonedToUtc(d, "12:00", tz);

  return (
    <>
      <PageHeader title="Calendar" action={<ButtonLink href={`/appointments/new?date=${picked}`}>Book</ButtonLink>} />
      <Page>
        <DayNav
          base="/calendar?"
          prev={addDaysYmd(monday, -7)}
          next={addDaysYmd(monday, 7)}
          today={today}
          label={`${dayLabel(noon(monday), tz)} – ${dayLabel(noon(days[6]), tz)}`}
          isToday={days.includes(today)}
        />
        {days.map((d) => {
          const list = appts.filter((a) => ymd(a.start_at, tz) === d);
          const active = list.filter((a) => !["cancelled", "no_show"].includes(a.status));
          const off = !workDays.has(weekdayOf(d));
          return (
            <section key={d} aria-labelledby={`day-${d}`} className="space-y-1">
              <div className="flex items-baseline justify-between px-1">
                <h2 id={`day-${d}`} className={`font-bold ${d === today ? "text-brand" : ""}`}>
                  {dayLabel(noon(d), tz)}
                  {d === today && <span className="ml-2 text-xs font-semibold uppercase">Today</span>}
                </h2>
                <span className="text-sm text-muted">
                  {off ? "Day off" : active.length ? `${active.length} · ${money(active.reduce((s, a) => s + a.total_cents, 0))}` : ""}
                </span>
              </div>
              {list.length === 0 ? (
                <Link
                  href={`/appointments/new?date=${d}`}
                  className="block rounded-[var(--radius-card)] border border-dashed border-line px-4 py-3 text-sm text-muted hover:bg-surface"
                >
                  {off ? "Day off · book anyway" : "Free · tap to book"}
                </Link>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
                  {list.map((a) => (
                    <li key={a.id}>
                      <Link href={`/appointments/${a.id}`} className="flex gap-3 px-4 py-3 hover:bg-bg">
                        <div className="w-20 shrink-0 text-sm">
                          <div className="font-semibold">{timeLabel(a.start_at, tz)}</div>
                          <div className="text-muted">{timeLabel(a.end_at, tz)}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate font-medium">{a.client_name}</span>
                            <StatusBadge status={a.paid ? "paid" : a.status} />
                          </div>
                          <div className="truncate text-sm text-muted">
                            {a.pets.map((p) => p.name).join(", ")}
                            {a.city ? ` · ${a.city}` : ""}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </Page>
    </>
  );
}
