"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/format";

const STATUSES = ["trial", "active", "past_due", "cancelled", "free"];

/** More days of trial for one business (from today, or from when it ends if that is later). */
export async function extendTrialAction(businessId: string, form: FormData) {
  await requireAdmin();
  const days = Math.min(90, Math.max(1, Number(form.get("days") ?? 14) || 14));
  if (!isUuid(businessId)) return;
  await sql`update businesses set plan_status = 'trial',
              trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + make_interval(days => ${days})
            where id = ${businessId}`;
  revalidatePath(`/admin/b/${businessId}`);
  revalidatePath("/admin");
}

/** Sets the plan by hand (until Stripe does it): free for a friend, cancelled, and so on. */
export async function setPlanStatusAction(businessId: string, form: FormData) {
  await requireAdmin();
  const status = String(form.get("status") ?? "");
  if (!isUuid(businessId) || !STATUSES.includes(status)) return;
  await sql`update businesses set plan_status = ${status},
              cancelled_at = case when ${status} = 'cancelled' then coalesce(cancelled_at, now()) else null end
            where id = ${businessId}`;
  revalidatePath(`/admin/b/${businessId}`);
  revalidatePath("/admin");
}
