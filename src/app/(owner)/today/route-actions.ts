"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { isExclusionViolation, sql } from "@/lib/db";
import { isYmd } from "@/lib/format";
import { notifyAppointment } from "@/lib/messaging";

const BOOKED = ["requested", "unconfirmed", "confirmed"];
const QUARTER = 15 * 60_000;

/**
 * Puts the day's visits in the best order (from "Find the best order" on Today): the first one
 * keeps the day's earliest start, each next one starts after the previous ends plus the drive,
 * rounded up to the quarter hour; every visit keeps its length. Clients whose time changed get
 * the booking message with the new time (when asked).
 */
export async function applyRouteOrderAction(date: string, form: FormData) {
  const staff = await requireStaff();
  if (!isYmd(date)) return;
  const ids = String(form.get("order") ?? "").split(",").filter((s) => /^[0-9a-f-]{36}$/.test(s));
  const drive = String(form.get("drive") ?? "").split(",").map(Number);
  const notify = form.get("notify") === "on";
  if (ids.length < 2 || drive.length !== ids.length || drive.some((m) => !Number.isFinite(m) || m < 0 || m > 600)) return;

  const visits = await sql<{ id: string; start_at: Date; end_at: Date; status: string; staff_id: string }[]>`
    select id, start_at, end_at, status, staff_id from appointments
    where business_id = ${staff.businessId} and id = any(${ids})`;
  // Only visits not started yet, all of one groomer, and each one once.
  if (visits.length !== ids.length || visits.some((v) => !BOOKED.includes(v.status))) return;
  if (new Set(visits.map((v) => v.staff_id)).size !== 1) return;
  if (!staff.can.all_appointments && visits[0].staff_id !== staff.staffId) return;

  const byId = new Map(visits.map((v) => [v.id, v]));
  let at = Math.min(...visits.map((v) => v.start_at.getTime()));
  const plan = ids.map((id, i) => {
    const v = byId.get(id)!;
    if (i > 0) at = Math.ceil((at + drive[i] * 60_000) / QUARTER) * QUARTER;
    const start = new Date(at);
    const end = new Date(at + (v.end_at.getTime() - v.start_at.getTime()));
    at = end.getTime();
    return { id, start, end, moved: start.getTime() !== v.start_at.getTime() };
  });

  try {
    await sql.begin(async (tx) => {
      // First out of the way (far in the future), then into place, so they never overlap midway.
      await tx`update appointments set start_at = start_at + interval '500 years', end_at = end_at + interval '500 years'
               where business_id = ${staff.businessId} and id = any(${ids})`;
      for (const p of plan) {
        await tx`update appointments set start_at = ${p.start}, end_at = ${p.end},
                   status = case when ${p.moved} and status = 'confirmed' then 'unconfirmed' else status end,
                   confirmed_at = case when ${p.moved} then null else confirmed_at end
                 where id = ${p.id} and business_id = ${staff.businessId}`;
      }
    });
  } catch (e) {
    // Another visit (outside this route) is in the way of a new time.
    if (isExclusionViolation(e)) redirect(`/today?date=${date}&optimize=1&clash=1`);
    throw e;
  }
  if (notify) for (const p of plan) if (p.moved) await notifyAppointment(p.id, "booked");
  revalidatePath("/today");
  revalidatePath("/calendar");
  redirect(`/today?date=${date}&reordered=1`);
}
