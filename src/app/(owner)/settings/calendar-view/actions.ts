"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import type { FormState } from "../actions";

export async function saveCalendarViewAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const on = (k: string) => form.get(k) === "on";
  const time = (k: string) => {
    const v = String(form.get(k) ?? "");
    return /^\d{2}:\d{2}$/.test(v) ? v : null;
  };
  const start = time("view_start");
  const end = time("view_end");
  const colorBy = String(form.get("color_by"));
  if (start && end && end <= start) return { error: "The calendar must end after it starts." };
  if (!["status", "staff", "service"].includes(colorBy)) return { error: "Pick what colors the visits." };
  await sql`
    update businesses set cal_show_client = ${on("show_client")}, cal_show_pets = ${on("show_pets")},
      cal_show_services = ${on("show_services")}, cal_show_address = ${on("show_address")}, cal_show_notes = ${on("show_notes")},
      cal_view_start = ${start}, cal_view_end = ${end}, cal_color_by = ${colorBy}
    where id = ${staff.businessId}`;
  revalidatePath("/calendar");
  revalidatePath("/settings/calendar-view");
  return { saved: true };
}
