"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isYmd } from "@/lib/format";
import { holidaysFor } from "@/lib/holidays";
import type { FormState } from "../actions";

export async function addClosedDatesAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requirePermission("settings");
  const start = String(form.get("start_date") ?? "");
  const end = String(form.get("end_date") ?? "") || start;
  const reason = String(form.get("reason") ?? "").trim().slice(0, 80) || null;
  if (!isYmd(start) || !isYmd(end)) return { error: "Pick the first and last day." };
  if (end < start) return { error: "The last day can't be before the first day." };
  await sql`insert into closed_dates (business_id, start_date, end_date, reason)
            values (${staff.businessId}, ${start}, ${end}, ${reason})`;
  revalidatePath("/settings/closed");
  revalidatePath("/calendar");
  return { saved: true };
}

export async function deleteClosedDatesAction(id: string) {
  const staff = await requirePermission("settings");
  await sql`delete from closed_dates where id = ${id} and business_id = ${staff.businessId}`;
  revalidatePath("/settings/closed");
  revalidatePath("/calendar");
}

export async function saveHolidaysAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requirePermission("settings");
  const closed = holidaysFor(staff.region.country).filter((h) => form.get(`closed:${h.key}`) === "on").map((h) => h.key);
  await sql`update businesses set closed_holidays = ${closed} where id = ${staff.businessId}`;
  revalidatePath("/settings/closed");
  revalidatePath("/calendar");
  return { saved: true };
}
