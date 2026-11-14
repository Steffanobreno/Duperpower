import { milesIn, type Point } from "./postal";

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

/** A visit already on the day, as a stop on the van's route. */
export type Stop = { start_at: Date; end_at: Date; zip: string | null };

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

/**
 * Whether a visit at `zip` from `start` to `end` (ms) keeps both drives within `limit` minutes:
 * from the stop before it and to the stop after it. A side with no stop has nothing to check (the
 * van's distance from home is the service radius's job). A stop at an unknown ZIP fails.
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
  const { prev, next } = neighborStops(stops, start, end);
  const fits = (other: string | null) => {
    const m = driveMinutesBetween(points, zip, other);
    return m != null && m <= limit;
  };
  return (!prev || fits(prev.zip)) && (!next || fits(next.zip));
}
