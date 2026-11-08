"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isRealYmd, isUuid } from "@/lib/format";

/**
 * The owner tapped WhatsApp or Text on Fill the gap: remember the invite (the row shows "Invited
 * today"). Once per client and day, so Text then WhatsApp counts as one invite.
 */
export async function recordOffer(clientId: string, date: string) {
  const staff = await requirePermission("client_contact");
  if (!isUuid(clientId) || !isRealYmd(date)) return;
  await sql`insert into fill_offers (business_id, client_id, day)
            select ${staff.businessId}, c.id, ${date} from clients c
            where c.id = ${clientId} and c.business_id = ${staff.businessId}
              and not exists (select 1 from fill_offers f
                              where f.business_id = ${staff.businessId} and f.client_id = c.id and f.day = ${date})`;
  revalidatePath(`/fill/${date}`);
}
