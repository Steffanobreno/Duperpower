import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";
import { addDaysYmd, dayRangeUtc, weekdayOf } from "../format";
import { closedDays } from "./closed";
import { overdueCount } from "./fill-gap";
import { LIVE } from "./reports";

// The KPI panel (spec 5.5): the month so far against the same days of last month, in the
// business time zone. One query per number, on the tables the app already has.

export type Kpi = {
  key: "revenue" | "visits" | "avg_ticket" | "return_rate" | "occupancy" | "no_shows" | "overdue" | "reports_sent" | "offers_booked";
  value: number;
  /** The same window last month; null when the number has no comparison. */
  previous: number | null;
  unit: "money" | "count" | "percent";
};

/** Days from..to (inclusive, YYYY-MM-DD) and the instants they cover in the business time zone. */
type Window = { from: string; to: string; start: Date; end: Date };

const windowOf = (staff: StaffContext, from: string, to: string): Window =>
  ({ from, to, start: dayRangeUtc(from, staff.timezone).start, end: dayRangeUtc(to, staff.timezone).end });

const firstOfMonth = (d: string) => `${d.slice(0, 8)}01`;
const firstOfPrevMonth = (d: string) => firstOfMonth(addDaysYmd(firstOfMonth(d), -1));
const lastOfMonth = (d: string) => addDaysYmd(firstOfMonth(addDaysYmd(firstOfMonth(d), 31)), -1);

/**
 * The 1st of today's month → today, and the same number of days from the 1st of last month
 * (never past its end: on the last day of a month, the whole of last month).
 */
export function monthWindows(today: string) {
  const from = firstOfMonth(today);
  const days = Math.round((Date.parse(today) - Date.parse(from)) / 86_400_000);
  const prevFrom = firstOfPrevMonth(today);
  const prevEnd = lastOfMonth(prevFrom);
  const sameDay = addDaysYmd(prevFrom, days);
  const prevTo = today === lastOfMonth(today) || sameDay > prevEnd ? prevEnd : sameDay;
  return { current: { from, to: today }, previous: { from: prevFrom, to: prevTo } };
}

/** Payments received in the window, tips left out: the "collected" of Reports. */
async function revenue(staff: StaffContext, w: Window) {
  const [{ n }] = await sql<{ n: number }[]>`
    select coalesce(sum(p.amount_cents), 0)::int as n
    from payments p join invoices i on i.id = p.invoice_id
    where i.business_id = ${staff.businessId} and p.received_at >= ${w.start} and p.received_at < ${w.end}`;
  return n;
}

/** Finished visits that started in the window. */
async function visits(staff: StaffContext, w: Window) {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from appointments
    where business_id = ${staff.businessId} and status = 'completed' and start_at >= ${w.start} and start_at < ${w.end}`;
  return n;
}

/** Of the clients seen in the last 60 days, the % who already have their next visit booked. */
async function returnRate(staff: StaffContext) {
  const [{ seen, back }] = await sql<{ seen: number; back: number }[]>`
    with seen as (
      select distinct client_id from appointments
      where business_id = ${staff.businessId} and status = 'completed'
        and start_at >= now() - interval '60 days' and start_at <= now())
    select count(*)::int as seen,
           count(*) filter (where exists (
             select 1 from appointments f where f.business_id = ${staff.businessId} and f.client_id = seen.client_id
               and f.status = any(${LIVE}) and f.start_at > now()))::int as back
    from seen`;
  return seen ? Math.round((back / seen) * 100) : 0;
}

/** That groomer's booked time ÷ their working hours on the open days of the window, in %. */
async function occupancy(staff: StaffContext, w: Window) {
  const [hours, closed, [{ booked }]] = await Promise.all([
    sql<{ weekday: number; minutes: number }[]>`
      select distinct on (weekday) weekday, (extract(epoch from end_time - start_time) / 60)::int as minutes
      from working_hours where staff_id = ${staff.staffId} order by weekday, start_time`,
    closedDays(staff.businessId, w.from, w.to),
    sql<{ booked: number }[]>`
      select coalesce(sum(extract(epoch from end_at - start_at) / 60), 0)::int as booked from appointments
      where business_id = ${staff.businessId} and staff_id = ${staff.staffId} and status = any(${LIVE})
        and start_at >= ${w.start} and start_at < ${w.end}`,
  ]);
  const perDay = new Map(hours.map((h) => [h.weekday, h.minutes]));
  let working = 0;
  for (let d = w.from; d <= w.to; d = addDaysYmd(d, 1)) if (!closed.has(d)) working += perDay.get(weekdayOf(d)) ?? 0;
  return working ? Math.round((booked / working) * 100) : 0;
}

/** No-shows and cancellations of visits that were to start in the window. */
async function noShows(staff: StaffContext, w: Window) {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from appointments
    where business_id = ${staff.businessId} and status in ('no_show', 'cancelled') and start_at >= ${w.start} and start_at < ${w.end}`;
  return n;
}

/** Grooming reports sent to clients in the window. */
async function reportsSent(staff: StaffContext, w: Window) {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from appointments
    where business_id = ${staff.businessId} and report_sent_at >= ${w.start} and report_sent_at < ${w.end}`;
  return n;
}

/** "Fill the gap" invites sent in the window after which the client booked a visit on that day. */
async function offersBooked(staff: StaffContext, w: Window) {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from fill_offers f
    where f.business_id = ${staff.businessId} and f.sent_at >= ${w.start} and f.sent_at < ${w.end}
      and exists (select 1 from appointments a
                  where a.business_id = ${staff.businessId} and a.client_id = f.client_id and a.status = any(${LIVE})
                    and a.created_at > f.sent_at and (a.start_at at time zone ${staff.timezone})::date = f.day)`;
  return n;
}

const pair = async (f: (staff: StaffContext, w: Window) => Promise<number>, staff: StaffContext, cur: Window, prev: Window) =>
  Promise.all([f(staff, cur), f(staff, prev)]);

/** The Reports panel: the month so far, each number against the same days of last month. */
export async function monthKpis(staff: StaffContext, today: string): Promise<Kpi[]> {
  const { current, previous } = monthWindows(today);
  const cur = windowOf(staff, current.from, current.to);
  const prev = windowOf(staff, previous.from, previous.to);
  const [rev, vis, ret, occ, noShow, overdue, sent, booked] = await Promise.all([
    pair(revenue, staff, cur, prev),
    pair(visits, staff, cur, prev),
    returnRate(staff),
    pair(occupancy, staff, cur, prev),
    pair(noShows, staff, cur, prev),
    overdueCount(staff, today),
    pair(reportsSent, staff, cur, prev),
    pair(offersBooked, staff, cur, prev),
  ]);
  const avg = (money: number, n: number) => (n ? Math.round(money / n) : 0);
  return [
    { key: "revenue", value: rev[0], previous: rev[1], unit: "money" },
    { key: "visits", value: vis[0], previous: vis[1], unit: "count" },
    { key: "avg_ticket", value: avg(rev[0], vis[0]), previous: avg(rev[1], vis[1]), unit: "money" },
    { key: "return_rate", value: ret, previous: null, unit: "percent" },
    { key: "occupancy", value: occ[0], previous: occ[1], unit: "percent" },
    { key: "no_shows", value: noShow[0], previous: noShow[1], unit: "count" },
    { key: "overdue", value: overdue, previous: null, unit: "count" },
    { key: "reports_sent", value: sent[0], previous: sent[1], unit: "count" },
    { key: "offers_booked", value: booked[0], previous: booked[1], unit: "count" },
  ];
}

/** Today's 3 numbers: the month's revenue, this week's occupancy (Monday to Sunday) and overdue clients. */
export async function todayKpis(staff: StaffContext, today: string): Promise<Kpi[]> {
  const { current, previous } = monthWindows(today);
  const monday = addDaysYmd(today, -((weekdayOf(today) + 6) % 7));
  const [rev, occ, overdue] = await Promise.all([
    pair(revenue, staff, windowOf(staff, current.from, current.to), windowOf(staff, previous.from, previous.to)),
    occupancy(staff, windowOf(staff, monday, addDaysYmd(monday, 6))),
    overdueCount(staff, today),
  ]);
  return [
    { key: "revenue", value: rev[0], previous: rev[1], unit: "money" },
    // A week has no "same days last month": no comparison.
    { key: "occupancy", value: occ, previous: null, unit: "percent" },
    { key: "overdue", value: overdue, previous: null, unit: "count" },
  ];
}
