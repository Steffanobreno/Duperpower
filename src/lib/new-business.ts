// What a new business starts with: services by dog size, add-ons, working hours, the message
// texts and a simple service agreement. Used by the signup (any new business) and by the seed
// (the first install). No "server-only": the seed script runs it too.
import type postgres from "postgres";

export type Size = "small" | "medium" | "large" | "xlarge";
export const SIZE_LABEL: Record<Size, string> = {
  small: 'Small (12" or less)',
  medium: 'Medium (12"-16")',
  large: 'Large (16"-20")',
  xlarge: 'X-Large (20" or up)',
};

export const haircut: [Size, number, number][] = [
  ["small", 120, 12900],
  ["medium", 120, 14900],
  ["large", 120, 17900],
  ["xlarge", 180, 19900],
];
export const bath: [Size, number, number][] = [
  ["small", 120, 9900],
  ["medium", 120, 10900],
  ["large", 120, 12900],
  ["xlarge", 120, 14900],
];
export const addons: [string, number, number][] = [
  ["Nail trim (included in every package)", 0, 0],
  ["Dematting or shave-down fee", 0, 4500],
  ["De-shedding", 0, 4500],
  ["Nail painting", 0, 1500],
  ["Sensitive care shampoo", 0, 2000],
  ["Flea treatment bath", 0, 2000],
  ["Hypoallergenic fragrance-free shampoo", 0, 1500],
  ["Skunk odor removal", 180, 28000],
];

// The owner's own message texts. Variables in {braces} are filled in when sending.
// {link} is the client's page to see, confirm or cancel the visit (no login needed).
export const templates = [
  {
    trigger: "booked",
    email_subject: "Your appointment with {business}",
    body: "From {business}, {client}, your appointment is booked for {date} at {time}. See or change it here: {link}",
  },
  {
    trigger: "request_received",
    email_subject: "We got your booking request",
    body: "Hi {client}! {business} received your request for {date} at {time}. We'll text you as soon as it's confirmed.",
  },
  {
    trigger: "request_declined",
    email_subject: "About your booking request",
    body: "Hi {client}, sorry, we can't make {date} at {time} work. Please pick another time at {booking_url} or text us at {business_phone}.",
  },
  {
    trigger: "reminder",
    offset_days: 2,
    send_at_time: "10:00",
    only_if_unconfirmed: true,
    email_subject: "Reminder: your appointment on {date}",
    body: "From {business}, {client}, your next appointment is coming up on {date} at {time}. Please confirm or cancel here: {link}",
  },
  {
    trigger: "reminder_2",
    offset_days: 1,
    send_at_time: "10:00",
    enabled: false,
    email_subject: "See you tomorrow, {date}",
    body: "Hi {client}! See you tomorrow, {date}, at {time} for {pet}'s grooming with {business}. Need to change it? {link}",
  },
  {
    trigger: "confirmed",
    email_subject: "Appointment confirmed",
    body: "Thank you, {client}! Your appointment on {date} at {time} is confirmed. See you then! 🐾",
  },
  {
    trigger: "cancelled",
    email_subject: "Appointment cancelled",
    body: "{client}, your appointment on {date} at {time} has been cancelled. Book again anytime at {booking_url} or text us at {business_phone}.",
  },
  {
    trigger: "on_my_way",
    body: "Hi {client}! {business} is on the way to you now 🚐",
  },
  {
    trigger: "rebook",
    send_at_time: "10:00",
    email_subject: "Time for {pet}'s next groom?",
    body: "From {business}, Hello {client}, it has been almost {days} days since {pet}'s last service. Would you like to book a new appointment? Book online: {booking_url} or text us {business_phone}",
  },
  {
    trigger: "abandoned_booking",
    offset_minutes: 120,
    email_subject: "Finish booking {pet}'s spa day?",
    body: "Hi {client}! Looks like you didn't get to finish booking {pet}'s visit with {business}. Pick a time here: {booking_url} or text us at {business_phone} and we'll book it for you. 🐾",
  },
  {
    trigger: "vaccine_due",
    offset_days: 30,
    send_at_time: "10:00",
    email_subject: "{pet}'s {vaccine} vaccine expires soon",
    body: "Hi {client}! Our records show {pet}'s {vaccine} vaccine expires on {expires}. When it's renewed, please text a photo of the new certificate to {business_phone}. Thank you! 🐾 {business}",
  },
  {
    trigger: "review_request",
    offset_minutes: 30,
    email_subject: "How did we do?",
    body: "Hi! 😊🐾 It was a pleasure taking care of your pet today! We hope you loved your experience with {business}. If you have a moment, your review truly means a lot to us 💙 👉 Leave your review here: {review_url} Thank you so much for your trust, and we hope to see you again soon! 🚐✨",
  },
];


/** A plain service agreement for a new business (the owner edits it in Settings → Service agreement). */
export const starterAgreement = (business: string) => ({
  title: `Service Agreement - ${business}`,
  body: `## Our service
${business} grooms your pet with care, safety and patience. We may stop a groom if your pet is too stressed, or if it isn't safe to continue.

## Health and safety
- Please tell us about any health problem, injury, allergy or behavior we should know before the visit.
- Vaccines must be up to date.
- Matted coats may need a shave-down for your pet's comfort, with an extra fee.

## Appointments
- Please give us at least **24 hours** notice to cancel or change a visit.
- A no-show or a late cancellation may be charged.

## Agreement
By booking you agree to these terms.`,
});

export type NewBusiness = {
  name: string;
  phone: string | null;
  slug: string;
  timezone: string;
  zip: string | null;
  country?: string;
  currency?: string;
  ownerName: string;
  ownerUserId?: string | null;
  extra?: { reviewUrl?: string; websiteUrl?: string; cancellationHours?: number; mailingAddress?: string };
  agreement?: { title: string; body: string };
};

/** Creates the business with everything it needs to start booking; returns its id and the owner's staff id. */
export async function createBusiness(tx: postgres.TransactionSql, b: NewBusiness) {
  const [biz] = await tx`
    insert into businesses (name, phone, booking_slug, timezone, start_zip, review_url, website_url, cancellation_hours, mailing_address,
                            country, currency)
    values (${b.name}, ${b.phone}, ${b.slug}, ${b.timezone}, ${b.zip}, ${b.extra?.reviewUrl ?? null}, ${b.extra?.websiteUrl ?? null},
            ${b.extra?.cancellationHours ?? 24}, ${b.extra?.mailingAddress ?? null}, ${b.country ?? "US"}, ${b.currency ?? "USD"})
    returning id`;
  const agreement = b.agreement ?? starterAgreement(b.name);
  await tx`insert into agreements (business_id, title, body) values (${biz.id}, ${agreement.title}, ${agreement.body})`;
  const [staff] = await tx`
    insert into staff (business_id, name, role, color, user_id)
    values (${biz.id}, ${b.ownerName}, 'owner', '#1d6fb8', ${b.ownerUserId ?? null})
    returning id`;
  // Monday-Saturday 7am-7pm, Sunday off.
  for (const weekday of [1, 2, 3, 4, 5, 6]) {
    await tx`insert into working_hours (staff_id, weekday, start_time, end_time) values (${staff.id}, ${weekday}, '07:00', '19:00')`;
  }
  let order = 0;
  for (const [size, min, cents] of haircut) {
    await tx`insert into services (business_id, name, kind, category, size_class, duration_min, price_cents, sort_order)
             values (${biz.id}, ${"Full Haircut - " + SIZE_LABEL[size]}, 'service', 'Haircut + Bath', ${size}, ${min}, ${cents}, ${order++})`;
  }
  for (const [size, min, cents] of bath) {
    await tx`insert into services (business_id, name, kind, category, size_class, duration_min, price_cents, sort_order)
             values (${biz.id}, ${"Bath - " + SIZE_LABEL[size]}, 'service', 'Bath', ${size}, ${min}, ${cents}, ${order++})`;
  }
  for (const [name, min, cents] of addons) {
    await tx`insert into services (business_id, name, kind, category, duration_min, price_cents, sort_order)
             values (${biz.id}, ${name}, 'addon', 'Add-on', ${min}, ${cents}, ${order++})`;
  }
  for (const t of templates) {
    await tx`insert into message_templates (business_id, trigger, body, email_subject, offset_days, offset_minutes,
                                           send_at_time, only_if_unconfirmed, enabled)
             values (${biz.id}, ${t.trigger}, ${t.body}, ${t.email_subject ?? null}, ${t.offset_days ?? null},
                     ${t.offset_minutes ?? null}, ${t.send_at_time ?? null}, ${t.only_if_unconfirmed ?? false}, ${t.enabled ?? true})`;
  }
  return { businessId: biz.id as string, staffId: staff.id as string };
}
