"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";

/** Clears a "didn't finish booking" entry (called them, not interested...). */
export async function dismissDraftAction(id: string) {
  const staff = await requireStaff();
  await sql`update booking_drafts set dismissed_at = now() where id = ${id} and business_id = ${staff.businessId}`;
  revalidatePath("/requests");
}
