"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/format";
import { emailReportCardNow } from "@/lib/messaging";

/** Emails the pet's report card link to the client. A deliberate resend goes out again. */
export async function emailReportCard(appointmentId: string): Promise<{ ok: true } | { error: string }> {
  const staff = await requirePermission("client_contact");
  if (!isUuid(appointmentId)) return { error: "Appointment not found." };
  const [a] = await sql`select 1 from appointments where id = ${appointmentId} and business_id = ${staff.businessId}`;
  if (!a) return { error: "Appointment not found." };
  const result = await emailReportCardNow(staff.businessId, appointmentId);
  if (result === "no-email") return { error: "This client has no email." };
  if (result === "nothing-to-show") return { error: "Add a photo, note or tag first." };
  if (result !== "sent") return { error: "Appointment not found." };
  revalidatePath(`/appointments/${appointmentId}`);
  return { ok: true };
}

/** The owner sent the report card from the phone (WhatsApp or Text): note it as sent, once. */
export async function markReportSent(appointmentId: string) {
  const staff = await requirePermission("client_contact");
  if (!isUuid(appointmentId)) return;
  await sql`update appointments set report_sent_at = coalesce(report_sent_at, now())
            where id = ${appointmentId} and business_id = ${staff.businessId}`;
  revalidatePath(`/appointments/${appointmentId}`);
}
