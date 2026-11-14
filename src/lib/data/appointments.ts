import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";
import { dayRangeUtc, addDaysYmd, hm, isUuid, ymd } from "../format";
import { driveMinutesBetween, driveRuleApplies, neighborStops } from "../geo/drive";
import { normPostal, postalPoints } from "../geo/postal";

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

/**
 * The drive to the other stops that day from this ZIP, when it is beyond the business limit
 * (`max_drive_minutes`, an estimate without traffic: the same one the booking page uses). With
 * `slot` (the visit's start and end), only the stop right before and the one right after count,
 * and the worse of the two is returned; without it, the closest stop. Null when the day is fine,
 * when there is no other stop, or when a place can't be measured (outside the US, with a postal
 * code that can't be placed, the rule is not applied). `at` and `city` say which visit it is.
 */
export async function tooFarFromDay(
  staff: StaffContext, date: string, zip: string | null, excludeId?: string, slot?: { start: Date; end: Date },
) {
  if (!zip) return null;
  const { start, end } = dayRangeUtc(date, staff.timezone);
  const [biz] = await sql<{ max_drive_minutes: number }[]>`select max_drive_minutes from businesses where id = ${staff.businessId}`;
  const limit = biz?.max_drive_minutes ?? 35;
  const others = await sql<{ start_at: Date; end_at: Date; zip: string | null; client: string; city: string | null }[]>`
    select a.start_at, a.end_at, a.zip, c.first_name as client, c.city from appointments a join clients c on c.id = a.client_id
    where a.business_id = ${staff.businessId} and a.staff_id = ${staff.staffId} and a.start_at >= ${start} and a.start_at < ${end}
      and a.status = any(${ROUTE_STATUSES})
      and (${excludeId ?? null}::uuid is null or a.id <> ${excludeId ?? null})`;
  if (!others.length) return null;
  const points = await postalPoints([zip, ...others.map((o) => o.zip)], staff.region.country);
  if (!driveRuleApplies(points, zip, staff.region.country)) return null;
  const candidates = slot
    ? Object.values(neighborStops(others, slot.start.getTime(), slot.end.getTime())).filter((s) => s != null)
    : others;
  const measured = candidates
    .map((o) => ({ minutes: driveMinutesBetween(points, zip, o.zip), client: o.client, at: o.start_at, city: o.city ?? points.get(normPostal(o.zip))?.city ?? null }))
    .filter((m): m is typeof m & { minutes: number } => m.minutes != null);
  if (!measured.length) return null;
  const pick = slot
    ? measured.reduce((w, m) => (m.minutes > w.minutes ? m : w))
    : measured.reduce((c, m) => (m.minutes < c.minutes ? m : c));
  return pick.minutes > limit ? { ...pick, limit } : null;
}

/**
 * The coming days when this groomer already has a visit close to `zip` (within the drive limit),
 * closest first: where to put a new visit so the route stays short. `after` is when the nearby
 * visit ends, rounded up to the next quarter hour.
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
  const best = new Map<string, { date: string; minutes: number; name: string; after: string }>();
  const points = await postalPoints([zip, ...rows.map((r) => r.zip)], staff.region.country);
  for (const r of rows) {
    const minutes = driveMinutesBetween(points, zip, r.zip);
    if (minutes == null || minutes > max) continue;
    const date = ymd(r.start_at, staff.timezone);
    const end = hm(new Date(Math.ceil(r.end_at.getTime() / 900_000) * 900_000), staff.timezone);
    const prev = best.get(date);
    if (!prev || minutes < prev.minutes) best.set(date, { date, minutes, name: r.first_name, after: end });
  }
  return [...best.values()].sort((a, b) => a.minutes - b.minutes || a.date.localeCompare(b.date)).slice(0, limit);
}
