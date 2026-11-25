import "server-only";
import type { TransactionSql } from "postgres";
import { sql } from "../db";
import { syncInvoiceServices } from "./invoices";

/**
 * Takes one pet (and its services) off a visit: the visit gets shorter by that pet's time and an
 * open or paid bill follows (reopened when it no longer covers the rest). Shared by the visit
 * screen and by "passed away".
 */
export async function dropPetFromVisit(tx: TransactionSql, appointmentId: string, appointmentPetId: string) {
  await tx`delete from appointment_pets where id = ${appointmentPetId} and appointment_id = ${appointmentId}`;
  const [{ m }] = await tx<{ m: number }[]>`
    select coalesce(sum(s.duration_min), 0)::int as m from appointment_services s
    join appointment_pets ap on ap.id = s.appointment_pet_id where ap.appointment_id = ${appointmentId}`;
  await tx`update appointments set end_at = start_at + make_interval(mins => greatest(${m}::int, 15)) where id = ${appointmentId}`;
  const [inv] = await tx<{ id: string }[]>`select id from invoices where appointment_id = ${appointmentId}`;
  if (inv) {
    await syncInvoiceServices(tx, appointmentId, inv.id);
    await tx`update invoices set status = 'open', closed_at = null where id = ${inv.id} and paid_cents < total_cents`;
  }
}

/** Visits still to come (requested, booked or confirmed). */
export const UPCOMING = ["requested", "unconfirmed", "confirmed"];

/** A pet's upcoming visits, with how many pets each one has. */
export function upcomingWithPet(businessId: string, petId: string) {
  return sql<{ appointment_id: string; appointment_pet_id: string; start_at: Date; pets: number }[]>`
    select a.id as appointment_id, ap.id as appointment_pet_id, a.start_at,
      (select count(*)::int from appointment_pets x where x.appointment_id = a.id) as pets
    from appointment_pets ap join appointments a on a.id = ap.appointment_id
    where ap.pet_id = ${petId} and a.business_id = ${businessId} and a.start_at > now() and a.status = any(${UPCOMING})
    order by a.start_at`;
}
