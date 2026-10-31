import "server-only";
import { createHash } from "node:crypto";
import { sql } from "./db";

// Google Maps Platform, called only from the server with one key (GOOGLE_MAPS_SERVER_KEY).
// Without the key, everything here quietly does nothing and the app works as before:
// addresses are typed by hand, map points come from the free US Census geocoder, and
// the Today route has no driving times.
// APIs used: Places API (New) for address suggestions, Geocoding API, Routes API.

const key = () => process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_API_KEY || null;
export const googleMapsOn = () => !!key();

// Tests point every Google host at a local fake server.
const endpoint = (host: string, path: string) =>
  `${(process.env.GOOGLE_MAPS_TEST_URL ?? `https://${host}`).replace(/\/$/, "")}${path}`;

async function call<T>(url: string, init: RequestInit & { fieldMask?: string }): Promise<T | null> {
  const k = key();
  if (!k) return null;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": k,
        ...(init.fieldMask ? { "X-Goog-FieldMask": init.fieldMask } : {}),
      },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export type Suggestion = { id: string; main: string; rest: string };

/** Address suggestions while typing (Places Autocomplete, US addresses). */
export async function suggestAddresses(input: string, sessionToken: string): Promise<Suggestion[]> {
  if (input.trim().length < 4) return [];
  const data = await call<{ suggestions?: { placePrediction?: {
    placeId: string; text?: { text: string }; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
  } }[] }>(endpoint("places.googleapis.com", "/v1/places:autocomplete"), {
    method: "POST",
    body: JSON.stringify({ input: input.slice(0, 200), sessionToken, includedRegionCodes: ["us"] }),
  });
  return (data?.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction;
    if (!p?.placeId) return [];
    return [{
      id: p.placeId,
      main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      rest: p.structuredFormat?.secondaryText?.text ?? "",
    }];
  }).slice(0, 5);
}

export type PickedAddress = { street: string; city: string; state: string; zip: string; lat: number | null; lng: number | null };

/** The chosen suggestion as street, city, state, ZIP and map point (ends the autocomplete session). */
export async function addressOf(placeId: string, sessionToken: string): Promise<PickedAddress | null> {
  if (!/^[\w-]{10,300}$/.test(placeId)) return null;
  const data = await call<{
    addressComponents?: { longText: string; shortText: string; types: string[] }[];
    location?: { latitude: number; longitude: number };
  }>(endpoint("places.googleapis.com", `/v1/places/${placeId}?sessionToken=${encodeURIComponent(sessionToken)}`), {
    method: "GET",
    fieldMask: "addressComponents,location",
  });
  if (!data?.addressComponents) return null;
  const part = (type: string, short = false) => {
    const c = data.addressComponents!.find((x) => x.types.includes(type));
    return c ? (short ? c.shortText : c.longText) : "";
  };
  const street = [part("street_number"), part("route", true)].filter(Boolean).join(" ");
  const unit = part("subpremise");
  return {
    street: unit ? `${street} #${unit}` : street,
    city: part("locality") || part("sublocality") || part("postal_town"),
    state: part("administrative_area_level_1", true),
    zip: part("postal_code"),
    lat: data.location?.latitude ?? null,
    lng: data.location?.longitude ?? null,
  };
}

export type Geo = { lat: number; lng: number; zip: string | null; city: string | null };

/** An address as a map point, with Google (null without the key). */
export async function geocode(address: string): Promise<Geo | null> {
  if (!address.trim() || !key()) return null;
  const url = new URL(endpoint("maps.googleapis.com", "/maps/api/geocode/json"));
  url.searchParams.set("address", address);
  url.searchParams.set("components", "country:US");
  url.searchParams.set("key", key()!);
  const data = await call<{ results?: { geometry: { location: { lat: number; lng: number } };
    address_components?: { long_name: string; types: string[] }[] }[] }>(url.toString(), { method: "GET" });
  const r = data?.results?.[0];
  if (!r) return null;
  const part = (type: string) => r.address_components?.find((c) => c.types.includes(type))?.long_name ?? null;
  return { lat: r.geometry.location.lat, lng: r.geometry.location.lng, zip: part("postal_code"), city: part("locality") };
}

export type Place = { address?: string | null; lat?: number | null; lng?: number | null };

const waypoint = (p: Place) =>
  p.lat != null && p.lng != null ? { location: { latLng: { latitude: p.lat, longitude: p.lng } } } : { address: p.address ?? "" };

/** Google's encoded polyline → [lat, lng] points. */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do {
        b = encoded.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && i < encoded.length);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lng += delta;
    }
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

export type DayRoute = { minutes: number[]; path: [number, number][] };

/**
 * The day's route by road (Routes API, one request for the whole day): driving minutes
 * between consecutive places and the road path to draw, or null without the key. Kept for a
 * week, so reopening Today costs nothing.
 */
export async function dayRoute(places: Place[]): Promise<DayRoute | null> {
  const valid = places.filter((p) => (p.lat != null && p.lng != null) || p.address);
  if (!key() || valid.length < 2 || valid.length > 27) return null;
  const cacheKey = createHash("sha256").update(JSON.stringify(valid.map(waypoint))).digest("hex");
  const [hit] = await sql<{ minutes: number[]; polyline: string | null }[]>`
    select minutes, polyline from route_cache where key = ${cacheKey} and created_at > now() - interval '7 days'`;
  if (hit?.polyline != null) return { minutes: hit.minutes, path: decodePolyline(hit.polyline) };
  const data = await call<{ routes?: { legs?: { duration?: string }[]; polyline?: { encodedPolyline?: string } }[] }>(
    endpoint("routes.googleapis.com", "/directions/v2:computeRoutes"),
    {
      method: "POST",
      fieldMask: "routes.legs.duration,routes.polyline.encodedPolyline",
      body: JSON.stringify({
        origin: waypoint(valid[0]),
        destination: waypoint(valid.at(-1)!),
        intermediates: valid.slice(1, -1).map(waypoint),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        polylineQuality: "OVERVIEW",
      }),
    },
  );
  const route = data?.routes?.[0];
  const legs = route?.legs;
  if (!legs || legs.length !== valid.length - 1) return null;
  const minutes = legs.map((l) => Math.round(Number(String(l.duration ?? "0s").replace("s", "")) / 60));
  const polyline = route.polyline?.encodedPolyline ?? "";
  await sql`insert into route_cache (key, minutes, polyline) values (${cacheKey}, ${minutes}, ${polyline})
            on conflict (key) do update set minutes = excluded.minutes, polyline = excluded.polyline, created_at = now()`;
  return { minutes, path: decodePolyline(polyline) };
}

export type BestOrder = {
  /** The stops' indices (0-based, among the stops passed) in the best order. */
  order: number[];
  /** Driving minutes along the best order: origin → first stop, …, last stop → destination. */
  minutes: number[];
};

/**
 * The order of the day's stops with the least driving, from `origin` to `destination`
 * (Routes API with optimizeWaypointOrder; up to 25 stops). Null without the key or on error.
 */
export async function bestOrder(origin: Place, stops: Place[], destination: Place): Promise<BestOrder | null> {
  if (!key() || stops.length < 2 || stops.length > 25) return null;
  const data = await call<{ routes?: { legs?: { duration?: string }[]; optimizedIntermediateWaypointIndex?: number[] }[] }>(
    endpoint("routes.googleapis.com", "/directions/v2:computeRoutes"),
    {
      method: "POST",
      fieldMask: "routes.legs.duration,routes.optimizedIntermediateWaypointIndex",
      body: JSON.stringify({
        origin: waypoint(origin),
        destination: waypoint(destination),
        intermediates: stops.map(waypoint),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        optimizeWaypointOrder: true,
      }),
    },
  );
  const route = data?.routes?.[0];
  const order = route?.optimizedIntermediateWaypointIndex;
  const legs = route?.legs;
  if (!order || order.length !== stops.length || !legs || legs.length !== stops.length + 1) return null;
  if ([...order].sort((a, b) => a - b).some((v, i) => v !== i)) return null;
  return { order, minutes: legs.map((l) => Math.round(Number(String(l.duration ?? "0s").replace("s", "")) / 60)) };
}

/** Driving minutes from where the groomer is now to a place, with today's traffic. Null without the key. */
export async function driveMinutesFrom(from: { lat: number; lng: number }, to: Place): Promise<number | null> {
  if (!key() || (!to.address && (to.lat == null || to.lng == null))) return null;
  const data = await call<{ routes?: { duration?: string }[] }>(
    endpoint("routes.googleapis.com", "/directions/v2:computeRoutes"),
    {
      method: "POST",
      fieldMask: "routes.duration",
      body: JSON.stringify({
        origin: waypoint(from),
        destination: waypoint(to),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
    },
  );
  const d = data?.routes?.[0]?.duration;
  return d ? Math.max(1, Math.round(Number(d.replace("s", "")) / 60)) : null;
}
