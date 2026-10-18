"use server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { notifyAppointment, notifyOwner } from "@/lib/messaging";
import { activeAgreement, currentSignature, recordSignature } from "@/lib/agreement";
import { dayLabel, timeLabel } from "@/lib/format";

// The client's own link. The token in the URL is the only key, so these actions only
// ever touch the one appointment it belongs to.

export async function confirmByTokenAction(token: string, form: FormData) {
  const [appt] = await sql`select id, business_id, client_id from appointments
                           where public_token = ${token} and status = 'unconfirmed' and start_at > now()`;
  if (!appt) return revalidatePath(`/a/${token}`);
  // Sign the service agreement first when it has not been signed in the last year.
  const agreement = await activeAgreement(appt.business_id);
  if (agreement && !(await currentSignature(agreement, appt.client_id))) {
    const name = String(form.get("signature") ?? "").trim();
    if (form.get("agree") !== "on" || name.length < 3) return revalidatePath(`/a/${token}`);
    await recordSignature(sql, agreement, appt.client_id, name);
  }
  await sql`update appointments set status = 'confirmed', confirmed_at = now() where id = ${appt.id} and status = 'unconfirmed'`;
  await notifyAppointment(appt.id, "confirmed");
  revalidatePath(`/a/${token}`);
}

export async function cancelByTokenAction(token: string) {
  const [a] = await sql`
    update appointments a set status = 'cancelled', cancelled_at = now()
    from businesses b
    where b.id = a.business_id and a.public_token = ${token}
      and a.status in ('requested', 'unconfirmed', 'confirmed')
      and a.start_at > now() + make_interval(hours => b.cancellation_hours)
    returning a.id, a.business_id, a.start_at, b.timezone,
      (select first_name || ' ' || last_name from clients where id = a.client_id) as client`;
  if (a) {
    await notifyAppointment(a.id, "cancelled");
    const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
    await notifyOwner(
      a.business_id,
      `Cancelled: ${a.client}, ${dayLabel(a.start_at, a.timezone)}`,
      `${a.client} cancelled ${dayLabel(a.start_at, a.timezone)} ${timeLabel(a.start_at, a.timezone)} from their link.\n${appUrl}/appointments/${a.id}`,
    );
  }
  revalidatePath(`/a/${token}`);
}
