"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff, requirePermission } from "@/lib/auth";
import { isUniqueViolation, sql } from "@/lib/db";
import { normalizePhone, parseMoney, SIZES } from "@/lib/format";
import { geocode } from "@/lib/maps";
import { savePetPhoto } from "@/lib/pet-photos";
import { sendEmail } from "@/lib/email";

export type FormState = { error?: string } | undefined;

const text = (form: FormData, key: string) => {
  const v = String(form.get(key) ?? "").trim();
  return v === "" ? null : v;
};

function readClient(form: FormData) {
  const first_name = text(form, "first_name");
  const phone = normalizePhone(form.get("phone"));
  if (!first_name) return { error: "First name is required." } as const;
  if (!phone) return { error: "Enter a 10-digit US phone number." } as const;
  return {
    values: {
      first_name,
      last_name: text(form, "last_name") ?? "",
      phone,
      email: text(form, "email"),
      address_line: text(form, "address_line"),
      city: text(form, "city"),
      state: text(form, "state") ?? "CA",
      zip: text(form, "zip"),
      access_notes: text(form, "access_notes"),
      // The client agreed to texts when the owner ticks this (TCPA).
      sms_consent: form.get("sms_consent") === "on",
      referral_source: text(form, "referral_source"),
      tags: [...new Set(form.getAll("tags").map((t) => String(t).trim()).filter((t) => t && t.length <= 60))],
    },
  } as const;
}

async function locate(v: { address_line: string | null; city: string | null; state: string | null; zip: string | null }) {
  const address = [v.address_line, v.city, v.state, v.zip].filter(Boolean).join(", ");
  return v.address_line ? geocode(address) : null;
}

async function saveTags(clientId: string, tags: readonly string[]) {
  await sql.begin(async (tx) => {
    await tx`delete from client_tags where client_id = ${clientId}`;
    for (const t of tags) await tx`insert into client_tags (client_id, label) values (${clientId}, ${t})`;
  });
}

export async function createClientAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = readClient(form);
  if ("error" in parsed) return { error: parsed.error };
  const v = parsed.values;
  const geo = await locate(v);
  let id: string;
  try {
    const [row] = await sql`
      insert into clients (business_id, first_name, last_name, phone, email, address_line, city, state, zip,
                           lat, lng, access_notes, sms_consent_at, source, referral_source)
      values (${staff.businessId}, ${v.first_name}, ${v.last_name}, ${v.phone}, ${v.email}, ${v.address_line},
              ${v.city ?? geo?.city ?? null}, ${v.state}, ${v.zip ?? geo?.zip ?? null}, ${geo?.lat ?? null},
              ${geo?.lng ?? null}, ${v.access_notes}, ${v.sms_consent ? new Date() : null}, 'manual', ${v.referral_source})
      returning id`;
    id = row.id;
    await saveTags(id, v.tags);
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "A client with this phone number already exists." };
    throw e;
  }
  redirect(`/clients/${id}/pets/new?first=1`);
}

export async function updateClientAction(clientId: string, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = readClient(form);
  if ("error" in parsed) return { error: parsed.error };
  const v = parsed.values;
  const geo = await locate(v);
  try {
    const rows = await sql`
      update clients set first_name = ${v.first_name}, last_name = ${v.last_name}, phone = ${v.phone},
        email = ${v.email}, address_line = ${v.address_line}, city = ${v.city ?? geo?.city ?? null},
        state = ${v.state}, zip = ${v.zip ?? geo?.zip ?? null}, lat = ${geo?.lat ?? null}, lng = ${geo?.lng ?? null},
        access_notes = ${v.access_notes}, referral_source = ${v.referral_source},
        sms_consent_at = case when ${v.sms_consent} then coalesce(sms_consent_at, now()) else null end
      where id = ${clientId} and business_id = ${staff.businessId}
      returning id`;
    if (rows.length === 0) return { error: "Client not found." };
    await saveTags(clientId, v.tags);
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Another client already has this phone number." };
    throw e;
  }
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function addNoteAction(clientId: string, form: FormData) {
  const staff = await requireStaff();
  const body = text(form, "body");
  if (!body) return;
  await sql`
    insert into client_notes (client_id, staff_id, body)
    select id, ${staff.staffId}, ${body} from clients where id = ${clientId} and business_id = ${staff.businessId}`;
  revalidatePath(`/clients/${clientId}`);
}

function readPet(form: FormData) {
  const name = text(form, "name");
  if (!name) return { error: "The pet's name is required." } as const;
  const size = text(form, "size_class");
  if (size && !SIZES.some((s) => s.value === size)) return { error: "Pick a size from the list." } as const;
  const weight = text(form, "weight_lbs");
  const rebook = text(form, "rebook_every_days");
  const rebookDays = rebook ? Number(rebook) : null;
  if (rebookDays !== null && !(rebookDays >= 7 && rebookDays <= 365))
    return { error: "Grooming frequency must be between 7 and 365 days." } as const;
  return {
    values: {
      name,
      breed: text(form, "breed"),
      size_class: size,
      weight_lbs: weight && Number.isFinite(Number(weight)) ? Number(weight) : null,
      coat_type: text(form, "coat_type"),
      birth_date: text(form, "birth_date"),
      sex: text(form, "sex"),
      behavior: text(form, "behavior"),
      behavior_tags: [...new Set(form.getAll("behavior_tags").map((t) => String(t).trim()).filter((t) => t && t.length <= 60))],
      fixed: form.get("fixed") === "yes" ? true : form.get("fixed") === "no" ? false : null,
      vet_name: text(form, "vet_name"),
      vet_phone: text(form, "vet_phone"),
      notes: text(form, "notes"),
      rebook_every_days: rebookDays,
    },
  } as const;
}

export async function savePetAction(clientId: string, petId: string | null, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = readPet(form);
  if ("error" in parsed) return { error: parsed.error };
  const v = parsed.values;
  const [owner] = await sql`select id from clients where id = ${clientId} and business_id = ${staff.businessId}`;
  if (!owner) return { error: "Client not found." };
  if (petId) {
    await sql`
      update pets set name = ${v.name}, breed = ${v.breed}, size_class = ${v.size_class}, weight_lbs = ${v.weight_lbs},
        coat_type = ${v.coat_type}, birth_date = ${v.birth_date}, sex = ${v.sex}, behavior = ${v.behavior},
        behavior_tags = ${v.behavior_tags}, fixed = ${v.fixed},
        vet_name = ${v.vet_name}, vet_phone = ${v.vet_phone}, notes = ${v.notes}, rebook_every_days = ${v.rebook_every_days}
      where id = ${petId} and client_id = ${clientId}`;
  } else {
    await sql`
      insert into pets (client_id, name, breed, size_class, weight_lbs, coat_type, birth_date, sex, behavior,
                        behavior_tags, fixed, vet_name, vet_phone, notes, rebook_every_days)
      values (${clientId}, ${v.name}, ${v.breed}, ${v.size_class}, ${v.weight_lbs}, ${v.coat_type}, ${v.birth_date},
              ${v.sex}, ${v.behavior}, ${v.behavior_tags}, ${v.fixed}, ${v.vet_name}, ${v.vet_phone}, ${v.notes}, ${v.rebook_every_days})`;
  }
  revalidatePath(`/clients/${clientId}`);
  redirect(form.get("then") === "book" ? `/appointments/new?client=${clientId}` : `/clients/${clientId}`);
}


export async function savePetPhotoAction(petId: string, form: FormData): Promise<{ error?: string }> {
  const staff = await requireStaff();
  const [pet] = await sql`select p.client_id from pets p join clients c on c.id = p.client_id
                          where p.id = ${petId} and c.business_id = ${staff.businessId}`;
  if (!pet) return { error: "Pet not found." };
  const file = form.get("photo");
  if (!(file instanceof Blob)) return { error: "Choose a photo." };
  const error = await savePetPhoto(petId, new Uint8Array(await file.arrayBuffer()));
  if (error) return { error };
  revalidatePath(`/clients/${pet.client_id}`);
  revalidatePath(`/clients/${pet.client_id}/pets/${petId}`);
  return {};
}

/** The switches under "Business control" on the client profile. */
export async function setClientControlAction(
  clientId: string, control: "inactive" | "block_messages" | "block_online" | "no_marketing", on: boolean,
) {
  const staff = await requireStaff();
  if (control === "inactive") {
    await sql`update clients set archived_at = ${on ? new Date() : null} where id = ${clientId} and business_id = ${staff.businessId}`;
  } else if (control === "block_messages") {
    await sql`update clients set sms_opted_out_at = ${on ? new Date() : null} where id = ${clientId} and business_id = ${staff.businessId}`;
  } else if (control === "no_marketing") {
    await sql`update clients set email_unsubscribed_at = ${on ? new Date() : null} where id = ${clientId} and business_id = ${staff.businessId}`;
  } else {
    await sql`update clients set online_booking_blocked = ${on} where id = ${clientId} and business_id = ${staff.businessId}`;
  }
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
}

/** Marks a pet as passed away (or undoes it): hidden from booking, lists and reminders. */
export async function setPetPassedAction(clientId: string, petId: string, passed: boolean) {
  const staff = await requireStaff();
  await sql`update pets p set deceased_at = ${passed ? new Date() : null}
            from clients c where c.id = p.client_id and p.id = ${petId} and c.business_id = ${staff.businessId}`;
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function deleteNoteAction(clientId: string, noteId: string) {
  const staff = await requireStaff();
  await sql`delete from client_notes n using clients c
            where n.id = ${noteId} and c.id = n.client_id and c.business_id = ${staff.businessId}`;
  revalidatePath(`/clients/${clientId}`);
}

export async function addVaccineAction(clientId: string, petId: string, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const expires = String(form.get("expires_on") ?? "");
  const given = String(form.get("given_on") ?? "");
  if (!name) return { error: "Pick the vaccine." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expires)) return { error: "Type when it expires (it's on the certificate)." };
  if (given && !/^\d{4}-\d{2}-\d{2}$/.test(given)) return { error: "Check the date it was given." };
  const [ok] = await sql`
    insert into vaccines (pet_id, name, given_on, expires_on)
    select p.id, ${name}, ${given || null}, ${expires} from pets p join clients c on c.id = p.client_id
    where p.id = ${petId} and c.business_id = ${staff.businessId}
    returning id`;
  if (!ok) return { error: "Pet not found." };
  revalidatePath(`/clients/${clientId}/pets/${petId}`);
  revalidatePath(`/clients/${clientId}`);
  return undefined;
}

export async function deleteVaccineAction(clientId: string, petId: string, vaccineId: string) {
  const staff = await requireStaff();
  await sql`delete from vaccines v using pets p, clients c
            where v.id = ${vaccineId} and p.id = v.pet_id and c.id = p.client_id and c.business_id = ${staff.businessId}`;
  revalidatePath(`/clients/${clientId}/pets/${petId}`);
  revalidatePath(`/clients/${clientId}`);
}

/** The pet's own price (and optionally time) for a service; booking uses it instead of the usual one. */
export async function savePetPriceAction(clientId: string, petId: string, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requirePermission("payments");
  const serviceId = String(form.get("service_id") ?? "");
  const price = parseMoney(form.get("price"));
  const minutesText = String(form.get("minutes") ?? "").trim();
  const minutes = minutesText === "" ? null : Number(minutesText);
  if (!serviceId) return { error: "Choose the service." };
  if (price == null) return { error: "Type the price, like 165 or 165.50." };
  if (minutes != null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 600)) {
    return { error: "Time is in minutes, like 150 (or leave it empty)." };
  }
  const [ok] = await sql`
    insert into pet_service_prices (pet_id, service_id, price_cents, duration_min)
    select p.id, s.id, ${price}, ${minutes}
    from pets p join clients c on c.id = p.client_id, services s
    where p.id = ${petId} and c.business_id = ${staff.businessId} and s.id = ${serviceId} and s.business_id = ${staff.businessId}
    on conflict (pet_id, service_id) do update set price_cents = excluded.price_cents,
      duration_min = excluded.duration_min, updated_at = now()
    returning pet_id`;
  if (!ok) return { error: "Pet or service not found." };
  revalidatePath(`/clients/${clientId}/pets/${petId}`);
  revalidatePath(`/clients/${clientId}`);
  return undefined;
}

export async function deletePetPriceAction(clientId: string, petId: string, serviceId: string) {
  const staff = await requirePermission("payments");
  await sql`delete from pet_service_prices x using pets p, clients c
            where x.pet_id = ${petId} and x.service_id = ${serviceId}
              and p.id = x.pet_id and c.id = p.client_id and c.business_id = ${staff.businessId}`;
  revalidatePath(`/clients/${clientId}/pets/${petId}`);
  revalidatePath(`/clients/${clientId}`);
}

/**
 * Removes a client for good: their pets, visits, bills and payments, notes and signatures.
 * Messages already sent stay in the log without the name. Can't be undone.
 */
export async function deleteClientAction(clientId: string) {
  const staff = await requirePermission("delete");
  await sql.begin(async (tx) => {
    const [c] = await tx`select id from clients where id = ${clientId} and business_id = ${staff.businessId} for update`;
    if (!c) return;
    await tx`delete from payments where invoice_id in (select id from invoices where client_id = ${clientId})`;
    await tx`delete from invoices where client_id = ${clientId}`;
    await tx`delete from appointments where client_id = ${clientId}`;
    await tx`delete from clients where id = ${clientId}`;
  });
  revalidatePath("/clients");
  revalidatePath("/calendar");
  revalidatePath("/today");
  revalidatePath("/reports");
  redirect("/clients?removed=1");
}

/** Puts the chosen codes on a pet (replacing the old ones). */
export async function setPetCodesAction(clientId: string, petId: string, form: FormData) {
  const staff = await requireStaff();
  const ids = form.getAll("code").map(String);
  await sql.begin(async (tx) => {
    const [pet] = await tx`select p.id from pets p join clients c on c.id = p.client_id
                           where p.id = ${petId} and c.id = ${clientId} and c.business_id = ${staff.businessId}`;
    if (!pet) return;
    await tx`delete from pet_pet_codes where pet_id = ${petId}`;
    if (ids.length)
      await tx`insert into pet_pet_codes (pet_id, pet_code_id)
               select ${petId}, id from pet_codes where business_id = ${staff.businessId} and id = any(${ids})`;
  });
  revalidatePath(`/clients/${clientId}`, "layout");
}

/** Emails the client the link to sign the service agreement. */
export async function emailSignLinkAction(clientId: string) {
  const staff = await requireStaff();
  const [c] = await sql`select c.first_name, c.email, c.sign_token, b.name as business from clients c join businesses b on b.id = c.business_id
                        where c.id = ${clientId} and c.business_id = ${staff.businessId}`;
  let result = "failed";
  if (c?.email) {
    const url = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/s/${c.sign_token}`;
    try {
      await sendEmail({
        to: c.email,
        subject: `Please sign the service agreement from ${c.business}`,
        text: `Hi ${c.first_name}! Please read and sign our service agreement here:\n${url}\n\nThank you!\n${c.business}`,
        fromName: c.business,
      });
      result = "sent";
    } catch {}
  }
  redirect(`/clients/${clientId}?signLink=${result}`);
}
