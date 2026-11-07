import "server-only";
import { sql } from "./db";

/**
 * The secret key of a device request: "Authorization: Bearer <key>" (kept out of server logs),
 * else ?key= in the link (what the iPhone Shortcut and calendar apps already use).
 */
export function deviceKeyOf(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return new URL(request.url).searchParams.get("key");
}

/** The business that owns this secret device key (iPhone Shortcut, calendar feed), or null. */
export async function businessForDeviceKey(key: string | null) {
  if (!key || key.length < 32) return null;
  const [b] = await sql<{ id: string; name: string; timezone: string }[]>`
    select id, name, timezone from businesses where device_key = ${key}`;
  return b ?? null;
}
