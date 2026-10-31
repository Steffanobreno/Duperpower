"use server";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { timeLabel } from "@/lib/format";
import { driveMinutesFrom } from "@/lib/maps";

/** How long the drive to this visit takes from where the phone is, and the arrival time. */
export async function etaAction(appointmentId: string, lat: number, lng: number) {
  const staff = await requireStaff();
  if (![lat, lng].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const [a] = await sql<{ address_line: string | null; zip: string | null; lat: number | null; lng: number | null }[]>`
    select address_line, zip, lat, lng from appointments where id = ${appointmentId} and business_id = ${staff.businessId}`;
  if (!a) return null;
  const minutes = await driveMinutesFrom({ lat, lng }, { address: [a.address_line, a.zip].filter(Boolean).join(" "), lat: a.lat, lng: a.lng });
  if (minutes == null) return null;
  return { minutes, arrive: timeLabel(new Date(Date.now() + minutes * 60_000), staff.timezone) };
}
