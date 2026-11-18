import "server-only";
import { sql } from "./db";
import { sniff } from "./pet-photos";

/** Saves (or replaces) a groomer's photo. Returns an error message, or null when saved. */
export async function saveStaffPhoto(staffId: string, bytes: Uint8Array) {
  if (bytes.length === 0) return "That picture is empty.";
  if (bytes.length > 1_000_000) return "That picture is too big.";
  const type = sniff(bytes);
  if (!type) return "Use a JPEG, PNG or WebP photo.";
  await sql`
    insert into staff_photos (staff_id, content_type, data) values (${staffId}, ${type}, ${Buffer.from(bytes)})
    on conflict (staff_id) do update set content_type = excluded.content_type, data = excluded.data, updated_at = now()`;
  return null;
}
