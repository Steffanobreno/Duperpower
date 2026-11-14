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
