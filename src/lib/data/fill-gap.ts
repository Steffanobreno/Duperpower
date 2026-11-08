import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";
import { addDaysYmd, dayRangeUtc, hm, longDayLabel, phoneLabel, timeLabel, todayYmd, weekdayOf, zonedToUtc } from "../format";
import { freeGaps, type Gap } from "../gaps";
import { normPostal, postalPoints, type Point } from "../geo/postal";
import { milesBetween } from "../geo/zip";
import { bookingUrl, manualTemplateBody, render } from "../messaging";
import { distanceOut, messageRegion } from "../region";
import { workingHoursFor } from "./appointments";
import { closedDays } from "./closed";

// Fill the gap (spec 5.3): the free time on a day, and who to invite to it. Waitlisted clients
// first, then clients due for a groom, closest to that day's route first.

/** Visits that hold the groomer's time (and, for clients, count as "already booked"). */
const LIVE = ["requested", "unconfirmed", "confirmed", "en_route", "in_progress", "completed"];
/** Without a grooming frequency on any pet, a client is due 6 weeks after the last visit. */
const DEFAULT_EVERY_DAYS = 42;

/** That groomer's visits on the day, with where they are. */
function dayStops(staff: StaffContext, date: string) {
  const { start, end } = dayRangeUtc(date, staff.timezone);
  return sql<{ start_at: Date; end_at: Date; zip: string | null; lat: number | null; lng: number | null }[]>`
    select start_at, end_at, zip, lat, lng from appointments
    where business_id = ${staff.businessId} and staff_id = ${staff.staffId}
      and start_at < ${end} and end_at > ${start} and status = any(${LIVE})
    order by start_at`;
}

export async function dayGaps(staff: StaffContext, date: string): Promise<Gap[]> {
  const { start, end } = dayRangeUtc(date, staff.timezone);
  const [hours, closed, stops, blocks, [svc]] = await Promise.all([
    workingHoursFor(staff, weekdayOf(date)),
    closedDays(staff.businessId, date, date),
    dayStops(staff, date),
    sql<{ start_at: Date; end_at: Date }[]>`
      select start_at, end_at from time_off
      where staff_id = ${staff.staffId} and start_at < ${end} and end_at > ${start}`,
    sql<{ min: number | null }[]>`
      select min(duration_min)::int as min from services
      where business_id = ${staff.businessId} and active and kind = 'service' and duration_min > 0`,
  ]);
  if (!hours || closed.has(date)) return [];
  // Clipped to the day, so a block from the day before starts at 00:00 and one into the next ends at 24:00.
  const local = (d: Date, edge: string) => (d <= start ? "00:00" : d >= end ? edge : hm(d, staff.timezone));
  const busy = [...stops, ...blocks].map((b) => ({ start: local(b.start_at, "00:00"), end: local(b.end_at, "24:00") }));
  return freeGaps({ start: hours.start_time.slice(0, 5), end: hours.end_time.slice(0, 5) }, busy, svc?.min ?? 60,
    date === todayYmd(staff.timezone) ? hm(new Date(), staff.timezone) : undefined);
}

/** The Today card: free slots on a day that hasn't passed, and the clients who could fill them. Null when there is nothing to offer. */
export async function fillSummary(staff: StaffContext, date: string): Promise<{ slots: number; nearby: number } | null> {
  if (date < todayYmd(staff.timezone)) return null;
  const gaps = await dayGaps(staff, date);
  if (!gaps.length) return null;
  return { slots: gaps.length, nearby: (await fillCandidates(staff, date, 30)).length };
}

/** Clients who can be invited that day at all: active, and with no visit in the 14 days around it. */
function invitable(staff: StaffContext, date: string) {
  const from = dayRangeUtc(addDaysYmd(date, -14), staff.timezone).start;
  const to = dayRangeUtc(addDaysYmd(date, 14), staff.timezone).end;
  return sql`c.archived_at is null
    and not exists (select 1 from appointments v where v.client_id = c.id and v.status = any(${LIVE})
                      and v.start_at >= ${from} and v.start_at < ${to})`;
}

/**
 * The "due" rule, in one place: clients with a live pet and nothing booked from now on, whose last
 * finished visit (here or in the old app) plus the pets' shortest grooming frequency falls on or
 * before the day + 7. One row per client, with how many days overdue they are on that day (0 or
 * less: due soon). Callers add `invitable()` (as `c`) once.
 */
function dueClients(staff: StaffContext, date: string) {
  return sql`
    select c.id as client_id, (${date}::date - (h.last_day + h.every))::int as days_overdue
    from clients c
    cross join lateral (
      select (greatest((select max(a.start_at) from appointments a where a.client_id = c.id and a.status = 'completed'),
                       c.imported_last_service_at) at time zone ${staff.timezone})::date as last_day,
             coalesce((select min(p.rebook_every_days) from pets p where p.client_id = c.id and p.deceased_at is null),
                      ${DEFAULT_EVERY_DAYS}) as every
    ) h
    where c.business_id = ${staff.businessId}
      and exists (select 1 from pets p where p.client_id = c.id and p.deceased_at is null)
      and not exists (select 1 from appointments f where f.client_id = c.id and f.status = any(${LIVE}) and f.start_at >= now())
      and h.last_day + h.every <= ${date}::date + 7`;
}

/** How many clients are due (or overdue) for a groom on that day, by the same rule as the list. */
export async function overdueCount(staff: StaffContext, date: string): Promise<number> {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from (${dueClients(staff, date)}) d join clients c on c.id = d.client_id
    where ${invitable(staff, date)}`;
  return n;
}

export type Candidate = {
  clientId: string;
  name: string;
  /** For the message ({client}). */
  firstName: string;
  phone: string | null;
  smsOk: boolean;
  pets: string;
  reason: "waitlist" | "due";
  daysOverdue: number | null;
  /** To the closest stop that day (else the van's start), in the business's unit; null: not on the map. */
  distance: number | null;
  offeredToday: boolean;
};

export async function fillCandidates(staff: StaffContext, date: string, limit = 30): Promise<Candidate[]> {
  const todayStart = dayRangeUtc(todayYmd(staff.timezone), staff.timezone).start;
  const [rows, stops, [biz]] = await Promise.all([
    sql<{ id: string; first_name: string; name: string; phone: string | null; sms_ok: boolean; pets: string | null;
          zip: string | null; lat: number | null; lng: number | null; waitlist: boolean; days_overdue: number | null; offered: boolean }[]>`
      with due as (${dueClients(staff, date)}),
      wait as (
        select distinct w.client_id from waitlist w
        where w.business_id = ${staff.businessId} and w.status = 'waiting' and ${date}::date between w.from_date and w.to_date)
      select c.id, c.first_name, trim(c.first_name || ' ' || c.last_name) as name, nullif(c.phone, '') as phone,
             c.sms_opted_out_at is null as sms_ok, c.zip, c.lat, c.lng,
             (select string_agg(p.name, ' & ' order by p.name) from pets p where p.client_id = c.id and p.deceased_at is null) as pets,
             wait.client_id is not null as waitlist, due.days_overdue,
             exists (select 1 from fill_offers f where f.business_id = ${staff.businessId} and f.client_id = c.id
                       and f.day = ${date} and f.sent_at >= ${todayStart}) as offered
      from clients c
      left join wait on wait.client_id = c.id
      left join due on due.client_id = c.id
      where c.business_id = ${staff.businessId} and (wait.client_id is not null or due.client_id is not null)
        and ${invitable(staff, date)}`,
    dayStops(staff, date),
    sql<{ start_zip: string | null }[]>`select start_zip from businesses where id = ${staff.businessId}`,
  ]);

  // Where the van is that day: its stops, else where it starts from.
  const country = staff.region.country;
  const points = await postalPoints([...rows.map((r) => r.zip), ...stops.map((s) => s.zip), biz?.start_zip], country);
  const at = (lat: number | null, lng: number | null, zip: string | null): Point | null =>
    lat != null && lng != null ? { lat, lng, city: null } : (points.get(normPostal(zip)) ?? null);
  const route = stops.map((s) => at(s.lat, s.lng, s.zip)).filter((p): p is Point => !!p);
  const van = at(null, null, biz?.start_zip ?? null);
  const from = route.length ? route : van ? [van] : [];
  const milesTo = (r: (typeof rows)[number]) => {
    const home = at(r.lat, r.lng, r.zip);
    return home && from.length ? Math.min(...from.map((p) => milesBetween(home, p))) : null;
  };
  const shown = (miles: number | null) =>
    miles == null ? null : staff.region.km ? distanceOut(miles, staff.region) : Math.round(miles * 10) / 10;

  const miles = new Map(rows.map((r) => [r.id, milesTo(r)]));
  const list = rows.map((r): Candidate => ({
    clientId: r.id, name: r.name, firstName: r.first_name, phone: r.phone, smsOk: r.sms_ok, pets: r.pets ?? "",
    reason: r.waitlist ? "waitlist" : "due", daysOverdue: r.waitlist ? null : r.days_overdue,
    distance: shown(miles.get(r.id) ?? null), offeredToday: r.offered,
  }));
  list.sort((a, b) =>
    Number(b.reason === "waitlist") - Number(a.reason === "waitlist")
    || (miles.get(a.clientId) ?? Infinity) - (miles.get(b.clientId) ?? Infinity)
    || a.name.localeCompare(b.name));
  return list.slice(0, limit);
}

/**
 * The gap offer for one client, filled in for that day and the first free time; null when the
 * owner switched the message off.
 */
export async function gapOfferText(staff: StaffContext, date: string, time: string) {
  const [body, [b]] = await Promise.all([
    manualTemplateBody(staff.businessId, "gap_offer"),
    sql<{ website_url: string | null; booking_slug: string | null; country: string; currency: string }[]>`
      select website_url, booking_slug, country, currency from businesses where id = ${staff.businessId}`,
  ]);
  if (!body || !b) return null;
  const rg = messageRegion(b.country, b.currency);
  const when = zonedToUtc(date, time, staff.timezone);
  const vars = {
    day: longDayLabel(when, staff.timezone, rg),
    time: timeLabel(when, staff.timezone, rg),
    booking_url: bookingUrl(b),
    business: staff.businessName,
    business_phone: phoneLabel(staff.businessPhone, b.country),
  };
  return (c: Candidate) => render(body, { ...vars, client: c.firstName, pet: c.pets });
}
