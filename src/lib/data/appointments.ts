import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";
import { dayRangeUtc, addDaysYmd, hm, isUuid, ymd } from "../format";
import { driveMinutesBetween, driveRuleApplies, farFromNeighbors, type Stop } from "../geo/drive";
import { normPostal, postalPoints, type Point } from "../geo/postal";

export type AppointmentListItem = {
  id: string;
  start_at: Date;
  end_at: Date;
  status: string;
  notes: string | null;
  address_line: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  client_id: string;
  client_name: string;
  client_phone: string;
  city: string | null;
  access_notes: string | null;
  pets: { id: string; name: string; breed: string | null; size_class: string | null; services: string[] }[];
  total_cents: number;
  paid: boolean;
  series_id: string | null;
  staff_id: string;
  staff_name: string;
  staff_color: string;
  /** The color of the visit's first service, for "color by service". */
  service_color: string | null;
  /** The client's first visit: nothing finished before, here or in the old app. */
  client_new: boolean;
};

const listSelect = (staff: StaffContext, start: Date, end: Date) => sql<AppointmentListItem[]>`
  select a.id, a.start_at, a.end_at, a.status, a.notes, a.address_line, a.zip, a.lat, a.lng, a.series_id,
         a.staff_id, st.name as staff_name, st.color as staff_color,
         c.id as client_id, trim(c.first_name || ' ' || c.last_name) as client_name,
         c.phone as client_phone, c.city, c.access_notes,
         coalesce((
           select json_agg(json_build_object(
                    'id', p.id, 'name', p.name, 'breed', p.breed, 'size_class', p.size_class,
                    'services', coalesce((select json_agg(s.name order by s.created_at)
                                          from appointment_services s where s.appointment_pet_id = ap.id), '[]'::json))
                  order by p.name)
           from appointment_pets ap join pets p on p.id = ap.pet_id
           where ap.appointment_id = a.id), '[]'::json) as pets,
         coalesce((select sum(s.price_cents) from appointment_pets ap
                   join appointment_services s on s.appointment_pet_id = ap.id
                   where ap.appointment_id = a.id), 0)::int as total_cents,
         exists (select 1 from invoices i where i.appointment_id = a.id and i.status = 'closed') as paid,
         (select sv.color from appointment_pets ap join appointment_services s on s.appointment_pet_id = ap.id
          join services sv on sv.id = s.service_id
          where ap.appointment_id = a.id and sv.color is not null order by s.created_at limit 1) as service_color,
         (c.imported_last_service_at is null and not exists (
            select 1 from appointments p where p.client_id = c.id and p.status = 'completed' and p.start_at < a.start_at)) as client_new
  from appointments a
  join clients c on c.id = a.client_id
  join staff st on st.id = a.staff_id
  where a.business_id = ${staff.businessId}
    and a.start_at >= ${start} and a.start_at < ${end}
    and a.status not in ('declined', 'waitlist')
  order by a.start_at`;

export function listDay(staff: StaffContext, date: string) {
  const { start, end } = dayRangeUtc(date, staff.timezone);
  return listSelect(staff, start, end);
}

export function listRange(staff: StaffContext, fromDate: string, days: number) {
  return listSelect(
    staff,
    dayRangeUtc(fromDate, staff.timezone).start,
    dayRangeUtc(addDaysYmd(fromDate, days - 1), staff.timezone).end,
  );
}

export type AppointmentDetail = {
  id: string;
  start_at: Date;
  end_at: Date;
  status: string;
  notes: string | null;
  address_line: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  series_id: string | null;
  staff_id: string;
  checked_in_at: Date | null;
  checked_out_at: Date | null;
  reschedule_requested_at: Date | null;
  reschedule_note: string | null;
  client: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    city: string | null;
    state: string | null;
    access_notes: string | null;
    sms_opted_out_at: string | null;
  };
  pets: {
    appointment_pet_id: string;
    pet_id: string;
    name: string;
    breed: string | null;
    size_class: string | null;
    behavior: string | null;
    notes: string | null;
    rebook_every_days: number | null;
    photo_version: string | null;
    services: { id: string; service_id: string; name: string; price_cents: number; duration_min: number }[];
  }[];
};

export async function getAppointment(staff: StaffContext, id: string) {
  if (!isUuid(id)) return null;
  const [row] = await sql<AppointmentDetail[]>`
    select a.id, a.start_at, a.end_at, a.status, a.notes, a.address_line, a.zip, a.lat, a.lng, a.series_id,
      a.staff_id, a.checked_in_at, a.checked_out_at, a.reschedule_requested_at, a.reschedule_note,
      json_build_object('id', c.id, 'first_name', c.first_name, 'last_name', c.last_name, 'phone', c.phone,
                        'city', c.city, 'state', c.state, 'access_notes', c.access_notes,
                        'sms_opted_out_at', c.sms_opted_out_at) as client,
      coalesce((
        select json_agg(json_build_object(
                 'appointment_pet_id', ap.id, 'pet_id', p.id, 'name', p.name, 'breed', p.breed,
                 'size_class', p.size_class, 'behavior', p.behavior, 'notes', p.notes,
                 'rebook_every_days', p.rebook_every_days,
                 'photo_version', (select ph.updated_at::text from pet_photos ph where ph.pet_id = p.id),
                 'services', coalesce((select json_agg(json_build_object(
                                'id', s.id, 'service_id', s.service_id, 'name', s.name,
                                'price_cents', s.price_cents, 'duration_min', s.duration_min) order by s.created_at)
                              from appointment_services s where s.appointment_pet_id = ap.id), '[]'::json))
               order by p.name)
        from appointment_pets ap join pets p on p.id = ap.pet_id
        where ap.appointment_id = a.id), '[]'::json) as pets
    from appointments a join clients c on c.id = a.client_id
    where a.id = ${id} and a.business_id = ${staff.businessId}`;
  // Without "see every groomer's visits", only their own.
  if (row && !staff.can.all_appointments && row.staff_id !== staff.staffId) return null;
  return row ?? null;
}

/** Working hours for the business owner on a weekday, or null if that day is off. */
export async function workingHoursFor(staff: StaffContext, weekday: number) {
  const [row] = await sql<{ start_time: string; end_time: string }[]>`
    select start_time::text, end_time::text from working_hours
    where staff_id = ${staff.staffId} and weekday = ${weekday}
    order by start_time limit 1`;
  return row ?? null;
}

/** The visits that hold the groomer's time on a day, for the drive rule. */
const ROUTE_STATUSES = ["requested", "unconfirmed", "confirmed", "en_route", "in_progress", "completed"];

/** Visits still ahead of the groomer, which hold time that online booking works around. */
const OPEN_STATUSES = ["requested", "unconfirmed", "confirmed", "en_route", "in_progress"];

/**
 * A visit online booking can't measure from: no ZIP and no coordinates. It closes the online times
 * next to it (unknown values block), so the owner is told to add the ZIP.
 */
export function closesOnlineBooking(a: { status: string; zip: string | null; lat: number | null; lng: number | null }) {
  return OPEN_STATUSES.includes(a.status) && !normPostal(a.zip) && (a.lat == null || a.lng == null);
}

/** A stop on a day's route, with who it is (for the warning). */
export type RouteStop = Stop & { id: string; client: string; city: string | null; staff_id: string };

/** Why a visit sits badly on the route: too far from a neighbor, or a neighbor that can't be measured. */
export type DriveWarning =
  | { kind: "far"; minutes: number; client: string; limit: number; at: Date; city: string | null }
  | { kind: "unknown"; client: string; limit: number; at: Date; city: string | null };

/** The same rule as the booking page (farFromNeighbors), shaped for a warning. */
export function driveWarningFor(
  points: Map<string, Point | null>, zip: string | null, country: string, stops: RouteStop[],
  slot: { start: Date; end: Date }, limit: number,
): DriveWarning | null {
  if (!zip || !stops.length || !driveRuleApplies(points, zip, country)) return null;
  const r = farFromNeighbors(points, zip, stops, slot.start.getTime(), slot.end.getTime(), limit);
  if (!r) return null;
  const { stop } = r;
  const who = { client: stop.client, limit, at: stop.start_at, city: stop.city ?? points.get(normPostal(stop.zip))?.city ?? null };
  return r.kind === "far" ? { kind: "far", minutes: r.minutes, ...who } : { kind: "unknown", ...who };
}

/** The stops of the given groomers on the given days (each a [staffId, "yyyy-mm-dd"] pair), one query. */
export async function routeStops(staff: StaffContext, days: { staffId: string; date: string }[], excludeIds: string[] = []) {
  if (!days.length) return [];
  const ranges = days.map((d) => ({ staffId: d.staffId, ...dayRangeUtc(d.date, staff.timezone) }));
  const from = new Date(Math.min(...ranges.map((r) => r.start.getTime())));
  const to = new Date(Math.max(...ranges.map((r) => r.end.getTime())));
  const rows = await sql<RouteStop[]>`
    select a.id, a.start_at, a.end_at, a.zip, a.lat, a.lng, a.staff_id, c.first_name as client, c.city
    from appointments a join clients c on c.id = a.client_id
    where a.business_id = ${staff.businessId} and a.staff_id = any(${[...new Set(days.map((d) => d.staffId))]})
      and a.start_at >= ${from} and a.start_at < ${to} and a.status = any(${ROUTE_STATUSES})
      and a.id <> all(${excludeIds}::uuid[])`;
  // Only the stops that fall on one of the asked days of their groomer.
  return rows.filter((r) => ranges.some((g) => g.staffId === r.staff_id && r.start_at >= g.start && r.start_at < g.end));
}

/**
 * Whether a visit at this ZIP on `date`, from `slot.start` to `slot.end`, is too far (over
 * `max_drive_minutes`, an estimate without traffic, the same one the booking page uses) from the
 * stop right before or after it, or has a neighbor that can't be measured. Null when the day is
 * fine, has no other stop, or (outside the US, with a postal code that can't be placed) the rule
 * is not applied.
 */
export async function tooFarFromDay(
  staff: StaffContext, date: string, zip: string | null, excludeId: string | undefined, slot: { start: Date; end: Date },
): Promise<DriveWarning | null> {
  if (!zip) return null;
  const [biz, stops] = await Promise.all([
    sql<{ max_drive_minutes: number }[]>`select max_drive_minutes from businesses where id = ${staff.businessId}`,
    routeStops(staff, [{ staffId: staff.staffId, date }], excludeId ? [excludeId] : []),
  ]);
  const points = await postalPoints([zip, ...stops.map((s) => s.zip)], staff.region.country);
  return driveWarningFor(points, zip, staff.region.country, stops, slot, biz[0]?.max_drive_minutes ?? 35);
}

/** The visit length nearbyDays assumes for its suggestion (the services aren't picked yet). */
const SUGGESTED_MINUTES = 60;

/**
 * The coming days when this groomer already has a visit close to `zip` (within the drive limit),
 * closest first: where to put a new visit so the route stays short. `after` is when the nearby
 * visit ends, rounded up to the next quarter hour; a day is suggested only when a visit there,
 * from `after` for an hour, is also within the limit of the stop after it (farFromNeighbors).
 */
export async function nearbyDays(staff: StaffContext, zip: string | null, limit = 4) {
  if (!zip) return [];
  const [rows, [biz]] = await Promise.all([
    sql<{ start_at: Date; end_at: Date; zip: string | null; first_name: string }[]>`
      select a.start_at, a.end_at, a.zip, c.first_name from appointments a join clients c on c.id = a.client_id
      where a.business_id = ${staff.businessId} and a.staff_id = ${staff.staffId}
        and a.start_at > now() and a.start_at < now() + interval '45 days' and a.zip is not null
        and a.status in ('requested', 'unconfirmed', 'confirmed')`,
    sql<{ max_drive_minutes: number }[]>`select max_drive_minutes from businesses where id = ${staff.businessId}`,
  ]);
  const max = biz?.max_drive_minutes ?? 35;
  const dates = [...new Set(rows.map((r) => ymd(r.start_at, staff.timezone)))];
  const stops = await routeStops(staff, dates.map((date) => ({ staffId: staff.staffId, date })));
  const points = await postalPoints([zip, ...rows.map((r) => r.zip), ...stops.map((s) => s.zip)], staff.region.country);
  const near = rows
    .map((r) => ({ r, minutes: driveMinutesBetween(points, zip, r.zip) }))
    .filter((x): x is { r: (typeof rows)[number]; minutes: number } => x.minutes != null && x.minutes <= max)
    .sort((a, b) => a.minutes - b.minutes);
  const best = new Map<string, { date: string; minutes: number; name: string; after: string }>();
  for (const { r, minutes } of near) {
    const date = ymd(r.start_at, staff.timezone);
    if (best.has(date)) continue;
    const start = Math.ceil(r.end_at.getTime() / 900_000) * 900_000;
    const sameDay = stops.filter((s) => ymd(s.start_at, staff.timezone) === date);
    // The stop after the suggested time must be within the limit too (and be measurable).
    if (farFromNeighbors(points, zip, sameDay, start, start + SUGGESTED_MINUTES * 60_000, max)) continue;
    best.set(date, { date, minutes, name: r.first_name, after: hm(new Date(start), staff.timezone) });
  }
  return [...best.values()].sort((a, b) => a.minutes - b.minutes || a.date.localeCompare(b.date)).slice(0, limit);
}
