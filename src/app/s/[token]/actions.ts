"use server";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { activeAgreement, recordSignature } from "@/lib/agreement";
import { notifyOwner } from "@/lib/messaging";

// The client's sign link (sent from their profile). The token is the only key.
export async function signByTokenAction(token: string, form: FormData) {
  const [c] = await sql`select id, business_id, trim(first_name || ' ' || last_name) as name from clients where sign_token = ${token}`;
  if (!c) redirect(`/s/${token}`);
  const agreement = await activeAgreement(c.business_id);
  if (!agreement) redirect(`/s/${token}`);
  const name = String(form.get("signature") ?? "").trim();
  if (form.get("agree") !== "on" || name.length < 3) redirect(`/s/${token}?needSign=1`);
  await recordSignature(sql, agreement, c.id, name);
  await notifyOwner(c.business_id, `${c.name} signed the service agreement`, `${c.name} signed “${agreement.title}”.`, `/clients/${c.id}`);
  redirect(`/s/${token}?signed=1`);
}
