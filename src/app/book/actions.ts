"use server";
import { isExclusionViolation, sql } from "@/lib/db";
import { findSlots, getPublicBusiness, onlineServices, zipProblem, type DaySlots } from "@/lib/booking";
import { normalizePhone, SIZES, ymd, dayLabel, timeLabel } from "@/lib/format";
import { notifyAppointment, notifyOwner } from "@/lib/messaging";
import { activeAgreement, recordSignature } from "@/lib/agreement";

export type PetRequest = { name: string; breed: string; size: string; serviceIds: string[] };

/** Validates the pets and services picked on the page and returns their total length. */
async function priceAndLength(businessId: string, pets: PetRequest[]) {
  if (!Array.isArray(pets) || pets.length === 0 || pets.length > 4) return { error: "Add between 1 and 4 pets." } as const;
  const services = await onlineServices(businessId);
  const byId = new Map(services.map((s) => [s.id, s]));
  let minutes = 0;
  for (const p of pets) {
    if (!String(p.name ?? "").trim()) return { error: "Each pet needs a name." } as const;
    if (!SIZES.some((s) => s.value === p.size)) return { error: `Pick ${p.name}'s size.` } as const;
    const mains = p.serviceIds.filter((id) => byId.get(id)?.kind === "service");
    if (mains.length !== 1) return { error: `Pick one service for ${p.name}.` } as const;
    for (const id of p.serviceIds) {
      const s = byId.get(id);
      if (!s) return { error: "One of the services is no longer available. Please refresh the page." } as const;
      if (s.size_class && s.size_class !== p.size) return { error: `That service doesn't match ${p.name}'s size.` } as const;
      minutes += s.duration_min;
    }
  }
  return { minutes, byId } as const;
}

export async function availabilityAction(input: { zip: string; pets: PetRequest[] }): Promise<{ error?: string; days?: DaySlots[] }> {
  const b = await getPublicBusiness();
  if (!b || !b.online_booking_enabled) return { error: "Online booking is closed right now. Please text us." };
  const zip = String(input.zip ?? "").trim();
  const problem = zipProblem(b, zip);
  if (problem) return { error: problem };
  const checked = await priceAndLength(b.id, input.pets);
  if ("error" in checked) return { error: checked.error };
  const days = await findSlots(b, zip, checked.minutes);
  if (days.length === 0) return { error: "No open times in your area right now. Please text us and we'll fit you in." };
  return { days };
}

export type BookingRequest = {
  pets: PetRequest[];
  start: string; // ISO time picked from the list
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  zip: string;
  notes: string;
  smsConsent: boolean;
  agreed: boolean;
  signature: string; // full name typed to sign the service agreement
  website: string; // honeypot: people never see this field
};

export async function requestBookingAction(input: BookingRequest): Promise<{ error?: string; ok?: boolean; when?: string }> {
  const b = await getPublicBusiness();
  if (!b || !b.online_booking_enabled) return { error: "Online booking is closed right now. Please text us." };
  if (input.website) return { ok: true }; // a bot filled the hidden field; pretend it worked

  const firstName = String(input.firstName ?? "").trim();
  const lastName = String(input.lastName ?? "").trim();
  const phone = normalizePhone(input.phone);
  const email = String(input.email ?? "").trim().toLowerCase();
  const address = String(input.address ?? "").trim();
  const city = String(input.city ?? "").trim();
  const zip = String(input.zip ?? "").trim();
  const notes = String(input.notes ?? "").trim().slice(0, 1000) || null;
  if (!firstName) return { error: "Please enter your first name." };
  if (!phone) return { error: "Please enter a 10-digit mobile number." };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Please check your email address." };
  if (!address || !city) return { error: "Please enter your street address and city." };
  const problem = zipProblem(b, zip);
  if (problem) return { error: problem };

  const checked = await priceAndLength(b.id, input.pets);
  if ("error" in checked) return { error: checked.error };
  const agreement = await activeAgreement(b.id);
  const signature = String(input.signature ?? "").trim();
  if (agreement?.required_online && (!input.agreed || signature.length < 3)) {
    return { error: "Please read the service agreement, tick the box and type your full name." };
  }
  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) return { error: "Please pick a time." };

  // The time must still be open under the same rules the page used.
  const day = ymd(start, b.timezone);
  const open = (await findSlots(b, zip, checked.minutes, day)).flatMap((d) => d.times.map((t) => t.value));
  if (!open.includes(start.toISOString())) return { error: "Sorry, that time was just taken. Please pick another one." };
  const end = new Date(start.getTime() + Math.max(checked.minutes, 15) * 60_000);

  // At most 3 online requests per phone number per day.
  const [{ recent }] = await sql`
    select count(*)::int as recent from appointments a join clients c on c.id = a.client_id
    where a.business_id = ${b.id} and a.source = 'online' and c.phone = ${phone} and a.created_at > now() - interval '1 day'`;
  if (recent >= 3) return { error: "You already sent a few requests today. We'll be in touch soon!" };

  let appointmentId: string;
  try {
    appointmentId = await sql.begin(async (tx) => {
      // Existing clients are matched by phone. Their saved details are never shown or
      // overwritten from this public page; what they typed goes into the visit notes.
      const [existing] = await tx`select id from clients where business_id = ${b.id} and phone = ${phone}`;
      let clientId: string = existing?.id;
      if (clientId && input.smsConsent) {
        await tx`update clients set sms_consent_at = coalesce(sms_consent_at, now()) where id = ${clientId} and sms_opted_out_at is null`;
      }
      if (!clientId) {
        const [c] = await tx`
          insert into clients (business_id, first_name, last_name, phone, email, address_line, city, state, zip,
                               sms_consent_at, source)
          values (${b.id}, ${firstName}, ${lastName}, ${phone}, ${email || null}, ${address}, ${city}, 'CA', ${zip},
                  ${input.smsConsent ? new Date() : null}, 'online')
          returning id`;
        clientId = c.id;
      }
      if (agreement?.required_online) await recordSignature(tx, agreement, clientId, signature);
      const fullAddress = `${address}, ${city}, CA`;
      const typed = existing
        ? `Online request from ${firstName} ${lastName}${email ? `, ${email}` : ""}. Address given: ${fullAddress} ${zip}.`
        : null;
      const [appt] = await tx`
        insert into appointments (business_id, client_id, staff_id, start_at, end_at, status, source, address_line, zip, notes)
        values (${b.id}, ${clientId}, ${b.staff_id}, ${start}, ${end}, 'requested', 'online', ${fullAddress}, ${zip},
                ${[typed, notes].filter(Boolean).join("\n") || null})
        returning id`;
      for (const p of input.pets) {
        const name = p.name.trim();
        const [found] = await tx`select id from pets where client_id = ${clientId} and lower(name) = lower(${name}) limit 1`;
        const petId: string =
          found?.id ??
          (await tx`insert into pets (client_id, name, breed, size_class) values (${clientId}, ${name}, ${p.breed.trim() || null}, ${p.size}) returning id`)[0].id;
        const [ap] = await tx`insert into appointment_pets (appointment_id, pet_id) values (${appt.id}, ${petId}) returning id`;
        for (const sid of p.serviceIds) {
          const s = checked.byId.get(sid)!;
          await tx`insert into appointment_services (appointment_pet_id, service_id, name, price_cents, duration_min)
                   values (${ap.id}, ${s.id}, ${s.name}, ${s.price_cents}, ${s.duration_min})`;
        }
      }
      return appt.id as string;
    });
  } catch (e) {
    if (isExclusionViolation(e)) return { error: "Sorry, that time was just taken. Please pick another one." };
    throw e;
  }

  await notifyAppointment(appointmentId, "request_received");
  const when = `${dayLabel(start, b.timezone)} ${timeLabel(start, b.timezone)}`;
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  await notifyOwner(
    b.id,
    `New booking request: ${input.pets.map((p) => p.name).join(" & ")}, ${when}`,
    `${firstName} ${lastName} (${input.phone}) asked for ${when} in ${city}.\nAccept or decline: ${appUrl}/requests`,
  );
  return { ok: true, when: `${dayLabel(start, b.timezone)} at ${timeLabel(start, b.timezone)}` };
}
