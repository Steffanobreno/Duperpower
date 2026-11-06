import "server-only";
import { sql } from "../db";
import { geocodePostal, googleMapsOn } from "../maps";
import { milesBetween, zipInfo } from "./zip";

// Postal codes as map points, in any country: the free California ZIP table first, then
// Google (once per code, kept in postal_points). Without Google outside that table, distances
// are unknown and nothing is refused for distance.

export type Point = { lat: number; lng: number; city: string | null };

/** "sw1a 1aa", "01310-100" → "SW1A1AA", "01310100": for comparing codes typed different ways. */
export const normPostal = (code: string | null | undefined) => (code ?? "").toUpperCase().replace(/[\s-]/g, "");

/** Whether an area's codes cover this postal code: the whole code, or its first part ("SW1", "013"). */
export function areaCovers(codes: string[], zip: string | null | undefined) {
  const z = normPostal(zip);
  return !!z && codes.some((c) => { const n = normPostal(c); return !!n && z.startsWith(n); });
}

export async function postalPoints(codes: (string | null | undefined)[], country: string): Promise<Map<string, Point | null>> {
  const out = new Map<string, Point | null>();
  const todo: string[] = [];
  for (const raw of new Set(codes.map(normPostal).filter(Boolean))) {
    const z = country === "US" ? zipInfo(raw.slice(0, 5)) : null;
    if (z) out.set(raw, { lat: z.lat, lng: z.lng, city: z.city });
    else todo.push(raw);
  }
  if (!todo.length) return out;
  const cached = await sql<{ code: string; lat: number | null; lng: number | null; city: string | null }[]>`
    select code, lat, lng, city from postal_points where country = ${country} and code = any(${todo})`;
  for (const c of cached) out.set(c.code, c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng, city: c.city } : null);
  if (!googleMapsOn()) return out;
  const missing = todo.filter((c) => !out.has(c)).slice(0, 10);
  await Promise.all(missing.map(async (code) => {
    const g = await geocodePostal(code, country);
    out.set(code, g ? { lat: g.lat, lng: g.lng, city: g.city } : null);
    await sql`insert into postal_points (country, code, lat, lng, city)
              values (${country}, ${code}, ${g?.lat ?? null}, ${g?.lng ?? null}, ${g?.city ?? null})
              on conflict (country, code) do nothing`;
  }));
  return out;
}

export async function postalPoint(code: string | null | undefined, country: string) {
  return (await postalPoints([code], country)).get(normPostal(code)) ?? null;
}

/** Miles between two postal codes already looked up (null when either is unknown). */
export function milesIn(points: Map<string, Point | null>, a: string | null | undefined, b: string | null | undefined) {
  const pa = points.get(normPostal(a));
  const pb = points.get(normPostal(b));
  return pa && pb ? milesBetween(pa, pb) : null;
}
