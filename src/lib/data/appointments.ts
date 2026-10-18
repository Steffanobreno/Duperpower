import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";
import { dayRangeUtc, addDaysYmd } from "../format";
import { zipMiles } from "../geo/zip";

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
  pets: { name: string; size_class: string | null; services: string[] }[];
  total_cents: number;
  paid: boolean;
};

const listSelect = (staff: StaffContext, start: Date, end: Date) => sql<AppointmentListItem[]>`
  select a.id, a.start_at, a.end_at, a.status, a.notes, a.address_line, a.zip, a.lat, a.lng,
         c.id as client_id, trim(c.first_name || ' ' || c.last_name) as client_name,
         c.phone as client_phone, c.city, c.access_notes,
         coalesce((
           select json_agg(json_build_object(
                    'name', p.name, 'size_class', p.size_class,
                    'services', coalesce((select json_agg(s.name order by s.created_at)
                                          from appointment_services s where s.appointment_pet_id = ap.id), '[]'::json))
                  order by p.name)
           from appointment_pets ap join pets p on p.id = ap.pet_id
           where ap.appointment_id = a.id), '[]'::json) as pets,
         coalesce((select sum(s.price_cents) from appointment_pets ap
                   join appointment_services s on s.appointment_pet_id = ap.id
                   where ap.appointment_id = a.id), 0)::int as total_cents,
         exists (select 1 from invoices i where i.appointment_id = a.id and i.status = 'closed') as paid
  from appointments a
  join clients c on c.id = a.client_id
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
  const [row] = await sql<AppointmentDetail[]>`
    select a.id, a.start_at, a.end_at, a.status, a.notes, a.address_line, a.zip, a.lat, a.lng, a.series_id,
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

/**
 * The farthest other stop that day from this ZIP, when it is beyond the business limit
 * (25 miles by default). Null when the day is fine or distances are unknown.
 */
export async function tooFarFromDay(staff: StaffContext, date: string, zip: string | null, excludeId?: string) {
  if (!zip) return null;
  const { start, end } = dayRangeUtc(date, staff.timezone);
  const [biz] = await sql<{ max_cluster_miles: string }[]>`select max_cluster_miles from businesses where id = ${staff.businessId}`;
  const limit = Number(biz?.max_cluster_miles ?? 25);
  const others = await sql<{ zip: string | null; client: string }[]>`
    select a.zip, c.first_name as client from appointments a join clients c on c.id = a.client_id
    where a.business_id = ${staff.businessId} and a.start_at >= ${start} and a.start_at < ${end}
      and a.status in ('requested', 'unconfirmed', 'confirmed', 'en_route', 'in_progress', 'completed')
      and (${excludeId ?? null}::uuid is null or a.id <> ${excludeId ?? null})`;
  let worst: { miles: number; client: string } | null = null;
  for (const o of others) {
    const miles = zipMiles(zip, o.zip);
    if (miles != null && miles > limit && (!worst || miles > worst.miles)) worst = { miles, client: o.client };
  }
  return worst ? { ...worst, limit } : null;
}
