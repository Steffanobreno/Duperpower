"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { sniff } from "@/lib/pet-photos";

/** Saves how a pet was groomed on this visit (and the photo of the cut, when one is added). */
export async function saveGroomAction(appointmentPetId: string, form: FormData): Promise<{ error?: string }> {
  const staff = await requireStaff();
  const [ap] = await sql<{ pet_id: string; appointment_id: string; client_id: string }[]>`
    select ap.pet_id, ap.appointment_id, a.client_id from appointment_pets ap join appointments a on a.id = ap.appointment_id
    where ap.id = ${appointmentPetId} and a.business_id = ${staff.businessId}`;
  if (!ap) return { error: "Visit not found." };
  const text = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max) || null;
  const file = form.get("photo");
  let photo: Buffer | null = null;
  let type: string | null = null;
  if (file instanceof Blob && file.size > 0) {
    if (file.size > 1_500_000) return { error: "That photo is too big." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    type = sniff(bytes);
    if (!type) return { error: "Use a JPEG, PNG or WebP photo." };
    photo = Buffer.from(bytes);
  }
  await sql`
    insert into pet_grooms (appointment_pet_id, pet_id, blade, style, note, photo, photo_type)
    values (${appointmentPetId}, ${ap.pet_id}, ${text("blade", 60)}, ${text("style", 120)}, ${text("note", 500)}, ${photo}, ${type})
    on conflict (appointment_pet_id) do update set blade = excluded.blade, style = excluded.style, note = excluded.note,
      photo = coalesce(excluded.photo, pet_grooms.photo), photo_type = coalesce(excluded.photo_type, pet_grooms.photo_type),
      updated_at = now()`;
  revalidatePath(`/appointments/${ap.appointment_id}`);
  revalidatePath(`/clients/${ap.client_id}/pets/${ap.pet_id}`);
  return {};
}
