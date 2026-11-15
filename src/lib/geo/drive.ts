import { milesIn, normPostal, type Point } from "./postal";
import { milesBetween } from "./zip";

// The free drive-time estimate: straight-line miles between ZIP centers, stretched for roads
// and divided by an average speed. Conservative on purpose (no traffic data). Change the
// calibration here and everything that uses drive time follows.

const DETOUR = 1.4;
const AVG_MPH = 35;
const MIN_MINUTES = 5;

/** "Near" (the star): at most this many estimated minutes. */
export const NEAR_DRIVE_MINUTES = 10;

export function driveMinutes(straightMiles: number): number {
  return Math.max(MIN_MINUTES, Math.round(((straightMiles * DETOUR) / AVG_MPH) * 60));
}

/** Estimated drive minutes between two postal codes already looked up (null when either is unknown). */
export function driveMinutesBetween(
  points: Map<string, Point | null>,
  a: string | null | undefined,
  b: string | null | undefined,
): number | null {
  const miles = milesIn(points, a, b);
  return miles == null ? null : driveMinutes(miles);
}

/**
 * Whether the drive rule (slotWithinDrive) applies to a client at `zip`. In the US always: an
 * unknown ZIP is refused before this (zipProblem), and unknown values block. Elsewhere a postal
 * code may be fine but impossible to place (no Google key, not in postal_points); then there is
 * nothing to measure from, and the rule is skipped rather than closing every day with a visit.
 */
export function driveRuleApplies(points: Map<string, Point | null>, zip: string, country: string) {
  return country === "US" || points.get(normPostal(zip)) != null;
}

/**
 * A visit already on the day, as a stop on the van's route. A visit with no ZIP is placed by its
 * own coordinates (from its address) when it has them; with neither it can't be placed.
 */
export type Stop = { start_at: Date; end_at: Date; zip: string | null; lat?: number | null; lng?: number | null };

/** Estimated drive minutes from the client's postal code to a stop (null when either can't be placed). */
function minutesToStop(points: Map<string, Point | null>, zip: string, stop: Stop): number | null {
  if (normPostal(stop.zip)) return driveMinutesBetween(points, zip, stop.zip);
  const from = points.get(normPostal(zip));
  return from && stop.lat != null && stop.lng != null ? driveMinutes(milesBetween(from, { lat: stop.lat, lng: stop.lng })) : null;
}

/** The stop right before a visit from `start` to `end` (ms) and the one right after it, that day. */
export function neighborStops<S extends Stop>(stops: S[], start: number, end: number) {
  let prev: S | null = null;
  let next: S | null = null;
  for (const s of stops) {
    if (s.end_at.getTime() <= start && (!prev || s.end_at > prev.end_at)) prev = s;
    if (s.start_at.getTime() >= end && (!next || s.start_at < next.start_at)) next = s;
  }
  return { prev, next };
}

export type FarFromNeighbors<S extends Stop> =
  | { kind: "far"; minutes: number; stop: S }
  | { kind: "unknown"; stop: S };

/**
 * How a visit at `zip` from `start` to `end` (ms) sits against the stop before it and the stop
 * after it (a side with no stop has nothing to check). "far": the worse side is over `limit`
 * minutes (wins over unknown). "unknown": no side is over, but a neighbor can't be placed (its ZIP
 * is unknown, or it has no ZIP and no coordinates; unknown values block). Null: both sides are measured and within the limit.
 * `points` must hold `zip` and every stop's ZIP (postalPoints).
 */
export function farFromNeighbors<S extends Stop>(
  points: Map<string, Point | null>,
  zip: string,
  stops: S[],
  start: number,
  end: number,
  limit: number,
): FarFromNeighbors<S> | null {
  const { prev, next } = neighborStops(stops, start, end);
  let far: { minutes: number; stop: S } | null = null;
  let unknown: S | null = null;
  for (const stop of [prev, next]) {
    if (!stop) continue;
    const minutes = minutesToStop(points, zip, stop);
    if (minutes == null) unknown ??= stop;
    else if (minutes > limit && (!far || minutes > far.minutes)) far = { minutes, stop };
  }
  return far ? { kind: "far", ...far } : unknown ? { kind: "unknown", stop: unknown } : null;
}

/**
 * Whether a visit at `zip` from `start` to `end` (ms) keeps both drives within `limit` minutes:
 * from the stop before it and to the stop after it. A side with no stop has nothing to check (the
 * van's distance from home is the service radius's job). A stop that can't be placed fails.
 * `points` must hold `zip` and every stop's ZIP (postalPoints).
 */
export function slotWithinDrive(
  points: Map<string, Point | null>,
  zip: string,
  stops: Stop[],
  start: number,
  end: number,
  limit: number,
): boolean {
  return farFromNeighbors(points, zip, stops, start, end, limit) == null;
}
