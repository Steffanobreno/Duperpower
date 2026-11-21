"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { draftsToMessage } from "@/lib/data/abandoned";
import { render, sendQueuedEmails } from "@/lib/messaging";
import { emailConfigured } from "@/lib/email";
import { phoneLabel } from "@/lib/format";

export type SendAllState = { error?: string; emailed?: number; texts?: { id: string; name: string; phone: string; body: string }[] } | undefined;

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * "Send to all": the same message, filled in for each person who started booking and didn't
 * finish (last 30 days, not booked since). Emails go out now to those who left one; the texts
 * come back as a list the owner sends one tap at a time from their phone (a phone app can't
 * send texts by itself). Everyone is marked contacted.
 */
export async function sendAllAction(_: SendAllState, form: FormData): Promise<SendAllState> {
  const staff = await requireStaff();
  const text = String(form.get("body") ?? "").trim().slice(0, 1000);
  const subject = String(form.get("subject") ?? "").trim().slice(0, 150) || staff.businessName;
  if (!text) return { error: "Write the message first." };
  const [b] = await sql<{ name: string; phone: string | null; booking_slug: string }[]>`
    select name, phone, booking_slug from businesses where id = ${staff.businessId}`;
  const people = await draftsToMessage(staff);
  if (!people.length) return { error: "Nobody to send to: everyone who started booking has booked since." };
  const stamp = new Date().toISOString().slice(0, 10);
  const texts: NonNullable<SendAllState>["texts"] = [];
  let emailed = 0;
  for (const d of people) {
    const body = render(text, {
      client: d.first_name ?? "there",
      pet: d.pets ?? "your pup",
      business: b.name,
      business_phone: phoneLabel(b.phone),
      booking_url: `${appUrl()}/book/${b.booking_slug}?phone=${encodeURIComponent(d.phone.replace(/^\+1/, ""))}`,
    });
    if (d.email && emailConfigured()) {
      const [queued] = await sql`
        insert into messages (business_id, client_id, direction, channel, to_email, subject, body, template_trigger, status, dedupe_key)
        values (${staff.businessId}, ${d.client_id}, 'out', 'email', ${d.email}, ${render(subject, { business: b.name })}, ${body},
                'abandoned_booking', 'queued', ${`abandoned-all:${d.id}:${stamp}`})
        on conflict (dedupe_key) do nothing returning id`;
      if (queued) emailed++;
    }
    texts.push({ id: d.id, name: [d.first_name, d.last_name].filter(Boolean).join(" ") || phoneLabel(d.phone), phone: d.phone, body });
  }
  await sql`update booking_drafts set contacted_at = coalesce(contacted_at, now())
            where business_id = ${staff.businessId} and id = any(${people.map((d) => d.id)})`;
  if (emailed) await sendQueuedEmails(staff.businessId);
  revalidatePath("/abandoned");
  return { emailed, texts };
}
