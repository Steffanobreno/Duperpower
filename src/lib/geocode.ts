import "server-only";
import { sql } from "./db";

import { geocode as googleGeocode, googleMapsOn } from "./maps";

// Street address → map point: Google when its key is set (more exact), else the US Census
// Bureau geocoder: free, no key, US addresses.
// https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html

async function geocode(address: string, country: string): Promise<{ lat: number; lng: number; by: string } | null> {
  const g = await googleGeocode(address, country);
  if (g) return { ...g, by: "google" };
  if (country !== "US") return null; // the Census geocoder knows only US addresses
  const c = await censusGeocode(address);
  return c ? { ...c, by: "census" } : null;
}

async function censusGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const u = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  u.searchParams.set("address", address);
  u.searchParams.set("benchmark", "Public_AR_Current");
  u.searchParams.set("format", "json");
  try {
    const res = await fetch(u, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const c = data?.result?.addressMatches?.[0]?.coordinates;
    return typeof c?.x === "number" && typeof c?.y === "number" ? { lat: c.y, lng: c.x } : null;
  } catch {
    return null;
  }
}

type Stop = { id: string; client_id: string; address_line: string | null; zip: string | null; lat: number | null; lng: number | null };

/**
 * Fills in the map points of the visits that don't have one yet (and their client's, when
 * missing), trying each address once. Once the Google key is set, visits placed earlier by
 * the Census geocoder are placed again with Google, once. Changes the stops in place.
 */
export async function locateStops(stops: Stop[], country = "US") {
  const google = googleMapsOn();
  const candidates = stops.filter((s) => s.address_line && (s.lat == null || google)).slice(0, 15);
  if (candidates.length === 0) return;
  const rows = await sql<{ id: string }[]>`
    select id from appointments where id = any(${candidates.map((s) => s.id)})
      and (geocode_tried_at is null or (${google} and geocoded_by is distinct from 'google'))`;
  const todo = candidates.filter((s) => rows.some((t) => t.id === s.id));
  await Promise.all(todo.map(async (s) => {
    const point = await geocode([s.address_line, s.zip].filter(Boolean).join(" "), country);
    // A Google miss keeps the old point; mark it so it isn't asked again.
    await sql`update appointments set geocode_tried_at = now(),
                geocoded_by = ${point?.by ?? (google ? "google" : null)},
                lat = coalesce(${point?.lat ?? null}, lat), lng = coalesce(${point?.lng ?? null}, lng)
              where id = ${s.id}`;
    if (!point) return;
    await sql`update clients set lat = ${point.lat}, lng = ${point.lng}
              where id = ${s.client_id} and (lat is null or ${point.by === "google"})
                and ${s.address_line} like address_line || '%'`; // only when the visit is at the client's address
    s.lat = point.lat;
    s.lng = point.lng;
  }));
}
