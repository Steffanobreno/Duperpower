import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";

export type ClientRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  access_notes: string | null;
  sms_consent_at: Date | null;
  sms_opted_out_at: Date | null;
  archived_at: Date | null;
};

export type PetRow = {
  id: string;
  client_id: string;
  name: string;
  species: string;
  breed: string | null;
  size_class: string | null;
  weight_lbs: string | null;
  coat_type: string | null;
  birth_date: string | null;
  sex: string | null;
  behavior: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  notes: string | null;
  rebook_every_days: number | null;
};

export const fullName = (c: { first_name: string; last_name: string }) =>
  `${c.first_name} ${c.last_name}`.trim();

export const fullAddress = (c: Pick<ClientRow, "address_line" | "city" | "state" | "zip">) =>
  [c.address_line, c.city, [c.state, c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");

export async function listClients(staff: StaffContext, q: string) {
  const term = q.trim();
  const like = `%${term}%`;
  const digits = term.replace(/\D/g, "");
  return sql<(ClientRow & { pet_names: string | null })[]>`
    select c.*, (select string_agg(p.name, ', ' order by p.name) from pets p
                 where p.client_id = c.id and p.deceased_at is null) as pet_names
    from clients c
    where c.business_id = ${staff.businessId} and c.archived_at is null
      and (${term} = ''
           or c.first_name || ' ' || c.last_name ilike ${like}
           or (${digits} <> '' and c.phone like ${"%" + digits + "%"})
           or exists (select 1 from pets p where p.client_id = c.id and p.name ilike ${like}))
    order by c.first_name, c.last_name
    limit 200`;
}

export async function getClient(staff: StaffContext, id: string) {
  const [client] = await sql<ClientRow[]>`
    select * from clients where id = ${id} and business_id = ${staff.businessId}`;
  return client ?? null;
}

export async function listPets(staff: StaffContext, clientId: string) {
  return sql<PetRow[]>`
    select p.*, p.birth_date::text as birth_date from pets p join clients c on c.id = p.client_id
    where p.client_id = ${clientId} and c.business_id = ${staff.businessId} and p.deceased_at is null
    order by p.name`;
}

export async function getPet(staff: StaffContext, petId: string) {
  const [pet] = await sql<PetRow[]>`
    select p.*, p.birth_date::text as birth_date from pets p join clients c on c.id = p.client_id
    where p.id = ${petId} and c.business_id = ${staff.businessId}`;
  return pet ?? null;
}

export async function listClientNotes(staff: StaffContext, clientId: string) {
  return sql<{ id: string; body: string; created_at: Date; staff_name: string | null }[]>`
    select n.id, n.body, n.created_at, s.name as staff_name
    from client_notes n join clients c on c.id = n.client_id
    left join staff s on s.id = n.staff_id
    where n.client_id = ${clientId} and c.business_id = ${staff.businessId}
    order by n.created_at desc`;
}

export async function clientHistory(staff: StaffContext, clientId: string) {
  return sql<{ id: string; start_at: Date; status: string; total_cents: number; pets: string | null; paid: boolean; upcoming: boolean }[]>`
    select a.id, a.start_at, a.status,
      (a.start_at >= now() and a.status not in ('cancelled', 'no_show', 'declined')) as upcoming,
      coalesce((select sum(s.price_cents) from appointment_pets ap
                join appointment_services s on s.appointment_pet_id = ap.id
                where ap.appointment_id = a.id), 0)::int as total_cents,
      (select string_agg(p.name, ', ') from appointment_pets ap join pets p on p.id = ap.pet_id
       where ap.appointment_id = a.id) as pets,
      exists (select 1 from invoices i where i.appointment_id = a.id and i.status = 'closed') as paid
    from appointments a
    where a.client_id = ${clientId} and a.business_id = ${staff.businessId}
    order by a.start_at desc
    limit 50`;
}
