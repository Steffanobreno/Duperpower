"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { isUniqueViolation, sql } from "@/lib/db";

/** Clock in (or out, when already in) for the logged-in team member. */
export async function toggleClockAction() {
  const staff = await requireStaff();
  const [b] = await sql`select clock_enabled from businesses where id = ${staff.businessId}`;
  if (!b?.clock_enabled) return;
  const [open] = await sql`update clock_entries set out_at = now() where staff_id = ${staff.staffId} and out_at is null returning id`;
  if (!open) {
    try {
      await sql`insert into clock_entries (staff_id, in_at) values (${staff.staffId}, now())`;
    } catch (e) {
      if (!isUniqueViolation(e)) throw e; // a double tap: already in
    }
  }
  revalidatePath("/today");
}
