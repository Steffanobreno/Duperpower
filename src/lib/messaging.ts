import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { sql } from "./db";
import { emailConfigured, sendEmail } from "./email";
import { addDaysYmd, dayRangeUtc, hm, phoneLabel, todayYmd, ymd } from "./format";

// Every client message goes through here. A message is a row in `messages`:
// - email rows are sent right away from the business Gmail;
// - SMS rows wait in the outbox until the owner's iPhone Shortcut collects and sends them.
// `dedupe_key` is unique, so running the same step twice never sends twice.

export type Trigger =
  | "booked"
  | "request_received"
  | "request_declined"
  | "reminder"
  | "confirmed"
  | "cancelled"
  | "on_my_way"
  | "rebook"
  | "review_request";

type Template = {
  body: string;
  email_subject: string | null;
  offset_days: number | null;
  offset_minutes: number | null;
  send_at_time: string | null;
  only_if_unconfirmed: boolean;
};

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export function render(text: string, vars: Record<string, string | number | null | undefined>) {
  return text.replace(/\{(\w+)\}/g, (all, key) => (vars[key] != null ? String(vars[key]) : all));
}

async function template(businessId: string, trigger: Trigger) {
  const [t] = await sql<Template[]>`
    select body, email_subject, offset_days, offset_minutes, to_char(send_at_time, 'HH24:MI') as send_at_time,
           only_if_unconfirmed
    from message_templates where business_id = ${businessId} and trigger = ${trigger} and enabled
    limit 1`;
  return t ?? null;
}

type ApptContext = {
  id: string;
  business_id: string;
  start_at: Date;
  status: string;
  public_token: string;
  business_name: string;
  business_phone: string | null;
  timezone: string;
  website_url: string | null;
  review_url: string | null;
  client_id: string;
  first_name: string;
  phone: string;
  email: string | null;
  sms_ok: boolean;
  pets: string | null;
};

async function appointmentContext(appointmentId: string) {
  const [row] = await sql<ApptContext[]>`
    select a.id, a.business_id, a.start_at, a.status, a.public_token,
           b.name as business_name, b.phone as business_phone, b.timezone, b.website_url, b.review_url,
           c.id as client_id, c.first_name, c.phone, c.email,
           (c.sms_consent_at is not null and c.sms_opted_out_at is null) as sms_ok,
           (select string_agg(p.name, ' & ' order by p.name) from appointment_pets ap
              join pets p on p.id = ap.pet_id where ap.appointment_id = a.id) as pets
    from appointments a
    join businesses b on b.id = a.business_id
    join clients c on c.id = a.client_id
    where a.id = ${appointmentId}`;
  return row ?? null;
}

export const bookingUrl = (b: { website_url: string | null }) => b.website_url ?? `${appUrl()}/book`;
export const appointmentLink = (token: string) => `${appUrl()}/a/${token}`;

function varsFor(c: ApptContext, extra: Record<string, string | number> = {}) {
  return {
    business: c.business_name,
    business_phone: phoneLabel(c.business_phone),
    client: c.first_name,
    pet: c.pets ?? "your pet",
    date: formatInTimeZone(c.start_at, c.timezone, "EEE, MMM d"),
    time: formatInTimeZone(c.start_at, c.timezone, "h:mm a"),
    link: appointmentLink(c.public_token),
    booking_url: bookingUrl(c),
    review_url: c.review_url ?? "",
    ...extra,
  };
}

/** Creates the SMS and email rows for one message (each only if the client can receive it). */
async function enqueue(c: ApptContext, trigger: Trigger, t: Template, dedupe: string, extra?: Record<string, string | number>) {
  const vars = varsFor(c, extra);
  const body = render(t.body, vars);
  if (c.sms_ok) {
    await sql`
      insert into messages (business_id, client_id, appointment_id, direction, channel, to_phone, body,
                            template_trigger, status, dedupe_key)
      values (${c.business_id}, ${c.client_id}, ${c.id}, 'out', 'sms', ${c.phone}, ${body}, ${trigger}, 'queued',
              ${`${dedupe}:sms`})
      on conflict (dedupe_key) do nothing`;
  }
  if (c.email) {
    const subject = render(t.email_subject ?? `${c.business_name}`, vars);
    await sql`
      insert into messages (business_id, client_id, appointment_id, direction, channel, to_email, subject, body,
                            template_trigger, status, dedupe_key)
      values (${c.business_id}, ${c.client_id}, ${c.id}, 'out', 'email', ${c.email}, ${subject}, ${body}, ${trigger},
              'queued', ${`${dedupe}:email`})
      on conflict (dedupe_key) do nothing`;
  }
}

/**
 * Sends a message about an appointment because something just happened
 * (booked, cancelled, request received...). Emails go out immediately.
 */
export async function notifyAppointment(appointmentId: string, trigger: Trigger) {
  const c = await appointmentContext(appointmentId);
  if (!c) return;
  const t = await template(c.business_id, trigger);
  if (!t) return;
  // Keyed on the start time, so a rescheduled visit gets a fresh "booked" message.
  await enqueue(c, trigger, t, `${trigger}:${c.id}:${c.start_at.getTime()}`);
  await sendQueuedEmails(c.business_id);
}

/** The text the owner sends by hand from the phone (e.g. "on my way"), filled in. */
export async function smsTextFor(appointmentId: string, trigger: Trigger) {
  const c = await appointmentContext(appointmentId);
  if (!c) return null;
  const t = await template(c.business_id, trigger);
  return t ? render(t.body, varsFor(c)) : null;
}

/** Works out which scheduled messages are due now and queues them. Safe to run often. */
export async function queueDueMessages(businessId: string) {
  const [biz] = await sql<{ timezone: string }[]>`select timezone from businesses where id = ${businessId}`;
  if (!biz) return;
  const tz = biz.timezone;
  const today = todayYmd(tz);
  const nowLocal = hm(new Date(), tz);

  // 1. Appointment reminders, N days before, from the set time of day.
  const reminder = await template(businessId, "reminder");
  if (reminder && nowLocal >= (reminder.send_at_time ?? "00:00")) {
    const { start, end } = dayRangeUtc(addDaysYmd(today, reminder.offset_days ?? 1), tz);
    const statuses = reminder.only_if_unconfirmed ? ["unconfirmed"] : ["unconfirmed", "confirmed"];
    const due = await sql<{ id: string }[]>`
      select id from appointments
      where business_id = ${businessId} and start_at >= ${start} and start_at < ${end} and status = any(${statuses})`;
    for (const a of due) {
      const c = await appointmentContext(a.id);
      if (c) await enqueue(c, "reminder", reminder, `reminder:${c.id}:${c.start_at.getTime()}`);
    }
  }

  // 2. Rebook reminders: the pet's grooming frequency has passed since the last visit
  //    and nothing is booked yet. Sent on the due date (or up to 3 days late if missed).
  const rebook = await template(businessId, "rebook");
  if (rebook && nowLocal >= (rebook.send_at_time ?? "00:00")) {
    const rows = await sql<{ id: string; start_at: Date; days: number | null }[]>`
      with last as (
        select distinct on (a.client_id) a.client_id, a.id, a.start_at
        from appointments a
        where a.business_id = ${businessId} and a.status = 'completed'
        order by a.client_id, a.start_at desc)
      select last.id, last.start_at,
        (select min(p.rebook_every_days) from appointment_pets ap join pets p on p.id = ap.pet_id
          where ap.appointment_id = last.id) as days
      from last
      where not exists (select 1 from appointments f where f.client_id = last.client_id and f.start_at > now()
                          and f.status in ('requested', 'unconfirmed', 'confirmed'))`;
    for (const r of rows) {
      if (!r.days) continue;
      const dueDate = addDaysYmd(ymd(r.start_at, tz), r.days);
      if (dueDate > today || dueDate < addDaysYmd(today, -3)) continue;
      const c = await appointmentContext(r.id);
      if (c) await enqueue(c, "rebook", rebook, `rebook:${r.id}`, { days: r.days });
    }
  }

  // 3. Review request, a while after checkout (only when a review link is set).
  const review = await template(businessId, "review_request");
  if (review) {
    const minutes = review.offset_minutes ?? 30;
    const rows = await sql<{ id: string }[]>`
      select a.id from appointments a
      join invoices i on i.appointment_id = a.id and i.status = 'closed'
      join businesses b on b.id = a.business_id
      where a.business_id = ${businessId} and b.review_url is not null
        and i.closed_at <= now() - make_interval(mins => ${minutes})
        and i.closed_at > now() - interval '2 days'`;
    for (const r of rows) {
      const c = await appointmentContext(r.id);
      if (c) await enqueue(c, "review_request", review, `review:${r.id}`);
    }
  }
}

/** Sends waiting emails. Each row is claimed first, so two runs never send the same email. */
export async function sendQueuedEmails(businessId: string) {
  if (!emailConfigured()) return;
  await sql`update messages set status = 'skipped', error = 'too old to send'
            where business_id = ${businessId} and channel = 'email' and status = 'queued'
              and created_at < now() - interval '2 days'`;
  const rows = await sql<{ id: string; to_email: string; subject: string; body: string; name: string }[]>`
    update messages m set status = 'handed_off'
    from businesses b
    where b.id = m.business_id and m.id in (
      select id from messages where business_id = ${businessId} and channel = 'email' and status = 'queued'
      order by created_at limit 50 for update skip locked)
    returning m.id, m.to_email, m.subject, m.body, b.name`;
  for (const r of rows) {
    try {
      await sendEmail({ to: r.to_email, subject: r.subject, text: r.body, fromName: r.name });
      await sql`update messages set status = 'sent', sent_at = now() where id = ${r.id}`;
    } catch (e) {
      await sql`update messages set status = 'failed', error = ${String((e as Error).message).slice(0, 500)} where id = ${r.id}`;
    }
  }
}

/**
 * Hands the waiting SMS to the iPhone Shortcut, which sends them from the owner's number.
 * Texts older than 36 hours are dropped instead (a late reminder is worse than none).
 */
export async function takeSmsOutbox(businessId: string) {
  await sql`update messages set status = 'skipped', error = 'too old to send'
            where business_id = ${businessId} and channel = 'sms' and status = 'queued'
              and created_at < now() - interval '36 hours'`;
  return sql<{ id: string; phone: string; body: string }[]>`
    update messages set status = 'handed_off', sent_at = now()
    where id in (select id from messages where business_id = ${businessId} and channel = 'sms' and status = 'queued'
                 order by created_at limit 40 for update skip locked)
    returning id, to_phone as phone, body`;
}

/** Everything the scheduled jobs do, for every business. */
export async function runMessagingJobs() {
  const businesses = await sql<{ id: string }[]>`select id from businesses`;
  for (const b of businesses) {
    await queueDueMessages(b.id);
    await sendQueuedEmails(b.id);
  }
}

/** Emails the owner (business email in Settings), e.g. a new online request or a cancellation. */
export async function notifyOwner(businessId: string, subject: string, text: string) {
  const [b] = await sql<{ email: string | null; name: string }[]>`select email, name from businesses where id = ${businessId}`;
  if (!b?.email || !emailConfigured()) return;
  await sendEmail({ to: b.email, subject, text, fromName: b.name }).catch(() => {});
}
