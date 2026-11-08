import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";

// The cut each pet got on each visit (blade or comb, length/style, note, photo).

export type Groom = {
  id: string; appointment_pet_id: string; appointment_id: string; pet_id: string; day: Date;
  blade: string | null; style: string | null; note: string | null; has_photo: boolean; v: string; tags: string[];
};

const select = (staff: StaffContext) => sql`
  select g.id, g.appointment_pet_id, ap.appointment_id, g.pet_id, a.start_at as day, g.blade, g.style, g.note, g.tags,
         g.photo is not null as has_photo, extract(epoch from g.updated_at)::bigint::text as v
  from pet_grooms g join appointment_pets ap on ap.id = g.appointment_pet_id
  join appointments a on a.id = ap.appointment_id
  where a.business_id = ${staff.businessId}`;

/** A pet's cuts, newest visit first. */
export function petGrooms(staff: StaffContext, petId: string) {
  return sql<Groom[]>`${select(staff)} and g.pet_id = ${petId} order by a.start_at desc limit 50`;
}

/** For a visit: this visit's cut per pet, and the cut before it (the last time). */
export async function visitGrooms(staff: StaffContext, appointmentId: string, petIds: string[]) {
  if (petIds.length === 0) return { now: new Map<string, Groom>(), last: new Map<string, Groom>() };
  const rows = await sql<Groom[]>`
    ${select(staff)} and g.pet_id = any(${petIds})
      and a.start_at <= (select start_at from appointments where id = ${appointmentId})
    order by a.start_at desc`;
  const now = new Map<string, Groom>();
  const last = new Map<string, Groom>();
  for (const r of rows) {
    if (r.appointment_id === appointmentId) now.set(r.pet_id, r);
    else if (!last.has(r.pet_id)) last.set(r.pet_id, r);
  }
  return { now, last };
}
