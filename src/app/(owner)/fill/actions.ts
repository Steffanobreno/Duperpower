"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isUuid, isYmd } from "@/lib/format";

/** The owner tapped WhatsApp or Text on Fill the gap: remember the invite (the row shows "Invited today"). */
export async function recordOffer(clientId: string, date: string) {
  const staff = await requireStaff();
  if (!isUuid(clientId) || !isYmd(date)) return;
  await sql`insert into fill_offers (business_id, client_id, day)
            select ${staff.businessId}, c.id, ${date} from clients c
            where c.id = ${clientId} and c.business_id = ${staff.businessId}`;
  revalidatePath(`/fill/${date}`);
}
