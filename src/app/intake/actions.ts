"use server";
import { sql } from "@/lib/db";
import { postalOk } from "@/lib/region";
import { getPublicBusiness } from "@/lib/booking";
import { normalizePhone, SIZES } from "@/lib/format";
import { notifyOwner } from "@/lib/messaging";

export type IntakeState = { error?: string; ok?: boolean } | undefined;

const text = (form: FormData, k: string, max = 120) => String(form.get(k) ?? "").trim().slice(0, max);

/**
 * The public new-client form: saves the client and their pets (or fills in what's missing for
 * a client already on file, matched by phone), and tells the owner. No booking.
 */
export async function submitIntakeAction(_: IntakeState, form: FormData): Promise<IntakeState> {
  const b = await getPublicBusiness(String(form.get("slug") ?? "") || null);
  if (!b) return { error: "Something went wrong. Please try again." };
  if (text(form, "website")) return { ok: true }; // a bot filled the hidden field
  const first = text(form, "first_name", 60);
  const last = text(form, "last_name", 60);
  const phone = normalizePhone(form.get("phone"), b.country);
  const email = text(form, "email", 160).toLowerCase() || null;
  const address = text(form, "address_line", 200) || null;
  const city = text(form, "city", 60) || null;
  const zip = text(form, "zip", 10) || null;
  const consent = form.get("sms_consent") === "on";
  if (!first) return { error: "Please enter your first name." };
  if (!phone) return b.country === "US" ? { error: "Please enter a 10-digit mobile number." } : { error: "Please check your mobile number." };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Please check your email address." };
  if (zip && !postalOk(zip, b.country)) return b.country === "US" ? { error: "Please check the ZIP code." } : { error: "Please check the postal code." };
  const pets = [0, 1, 2].map((i) => ({
    name: text(form, `pet_name:${i}`, 80),
    breed: text(form, `pet_breed:${i}`, 120) || null,
    size: SIZES.some((s) => s.value === form.get(`pet_size:${i}`)) ? String(form.get(`pet_size:${i}`)) : null,
    notes: text(form, `pet_notes:${i}`, 1000) || null,
  })).filter((p) => p.name);
  if (!pets.length) return { error: "Please add your pet's name." };

  const [{ recent }] = await sql`select count(*)::int as recent from intake_submissions
                                 where business_id = ${b.id} and data->>'phone' = ${phone} and created_at > now() - interval '1 day'`;
  if (recent >= 3) return { ok: true };

  const clientId = await sql.begin(async (tx) => {
    const [existing] = await tx`select id from clients where business_id = ${b.id} and phone = ${phone}`;
    let id: string;
    if (existing) {
      id = existing.id;
      // Never overwrite what the owner has; only fill blanks.
      await tx`update clients set email = coalesce(email, ${email}), address_line = coalesce(address_line, ${address}),
                 city = coalesce(city, ${city}), zip = coalesce(zip, ${zip}),
                 sms_consent_at = case when ${consent} and sms_opted_out_at is null then coalesce(sms_consent_at, now()) else sms_consent_at end
               where id = ${id}`;
    } else {
      const [c] = await tx`
        insert into clients (business_id, first_name, last_name, phone, email, address_line, city, state, zip, sms_consent_at, source)
        values (${b.id}, ${first}, ${last}, ${phone}, ${email}, ${address}, ${city}, (select case when country = 'US' then state end from businesses where id = ${b.id}), ${zip}, ${consent ? new Date() : null}, 'online')
        returning id`;
      id = c.id;
    }
    for (const p of pets) {
      const [same] = await tx`select id from pets where client_id = ${id} and lower(name) = lower(${p.name}) and deceased_at is null`;
      if (same) {
        await tx`update pets set breed = coalesce(breed, ${p.breed}), size_class = coalesce(size_class, ${p.size}),
                   notes = coalesce(notes, ${p.notes}) where id = ${same.id}`;
      } else {
        await tx`insert into pets (client_id, name, breed, size_class, notes) values (${id}, ${p.name}, ${p.breed}, ${p.size}, ${p.notes})`;
      }
    }
    await tx`insert into intake_submissions (business_id, client_id, data)
             values (${b.id}, ${id}, ${tx.json({ first, last, phone, email, address, city, zip, pets })})`;
    return id as string;
  });

  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  await notifyOwner(b.id, `New client form: ${first} ${last}`.trim(),
    `${first} ${last} (${String(form.get("phone"))}) sent their info: ${pets.map((p) => p.name).join(" & ")}.\nSee the client: ${appUrl}/clients/${clientId}`,
    `/clients/${clientId}`);
  return { ok: true };
}
