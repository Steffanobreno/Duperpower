import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";

// Pending visits, so the owner closes them from one list instead of hunting one by one:
// "to close" — over (end_at passed) but never marked done; "to collect" — done, no closed bill.
// Counting starts on the day of the first bill closed in the app: older visits came from the old
// app and were never paid here. With no closed bill yet, everything counts.

export type PendingKind = "close" | "collect";
export type PendingVisit = {
  id: string; start_at: Date; kind: PendingKind; client: string; pets: string | null; price_cents: number;
};

const OPEN = ["unconfirmed", "confirmed", "en_route", "in_progress"];

/** The pending condition, for a visit row `a` of the staff's business. */
const pendingWhere = (staff: StaffContext) => sql`
  a.business_id = ${staff.businessId}
  and a.start_at >= coalesce(
        (select date_trunc('day', min(i.closed_at) at time zone ${staff.timezone}) at time zone ${staff.timezone}
         from invoices i where i.business_id = ${staff.businessId} and i.status = 'closed'),
        '-infinity'::timestamptz)
  and ((a.status = any(${OPEN}) and a.end_at < now())
       or (a.status = 'completed'
           and not exists (select 1 from invoices i where i.appointment_id = a.id and i.status = 'closed')))`;

/** Pending visits that start in [from, to), oldest first. */
export function pendingIn(staff: StaffContext, from: Date, to: Date) {
  return sql<PendingVisit[]>`
    select a.id, a.start_at,
      case when a.status = 'completed' then 'collect' else 'close' end as kind,
      trim(c.first_name || ' ' || coalesce(c.last_name, '')) as client,
      (select string_agg(p.name, ' & ' order by p.name) from appointment_pets ap join pets p on p.id = ap.pet_id
        where ap.appointment_id = a.id) as pets,
      coalesce((select sum(s.price_cents) from appointment_pets ap join appointment_services s on s.appointment_pet_id = ap.id
                where ap.appointment_id = a.id), 0)::int as price_cents
    from appointments a join clients c on c.id = a.client_id
    where ${pendingWhere(staff)} and a.start_at >= ${from} and a.start_at < ${to}
    order by a.start_at`;
}

/** How many are pending before `before`, and when the oldest one starts. */
export async function pendingBefore(staff: StaffContext, before: Date) {
  const [r] = await sql<{ n: number; oldest: Date | null }[]>`
    select count(*)::int as n, min(a.start_at) as oldest from appointments a
    where ${pendingWhere(staff)} and a.start_at < ${before}`;
  return r;
}

/** All pending visits, for the badge in the menu and on Today. */
export async function pendingCount(staff: StaffContext) {
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from appointments a where ${pendingWhere(staff)}`;
  return r.n;
}
