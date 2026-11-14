// driveMinutes: the free drive-time estimate from straight-line miles.
// Usage: npx tsx --conditions=react-server tests/drive.test.mjs  (drive.ts wraps postal.ts, which is server-only)
import assert from "node:assert/strict";
import { driveMinutes, driveMinutesBetween, NEAR_DRIVE_MINUTES } from "../src/lib/geo/drive.ts";

assert.equal(driveMinutes(25.3), 61);
assert.equal(driveMinutes(19.7), 47);
assert.equal(driveMinutes(8.1), 19);
console.log("✓ the estimate matches the spec's table (Redwood City → Piedmont ~61 min)");

assert.equal(driveMinutes(0), 5);
assert.equal(driveMinutes(1), 5);
console.log("✓ never less than 5 minutes");

const pts = new Map([
  ["94063", { lat: 37.48, lng: -122.2, city: "Redwood City" }],
  ["94611", { lat: 37.83, lng: -122.2, city: "Piedmont" }],
  ["99999", null],
]);
const m = driveMinutesBetween(pts, "94063", "94611");
assert.ok(typeof m === "number" && m > 40);
assert.equal(driveMinutesBetween(pts, "94063", "99999"), null);
assert.equal(driveMinutesBetween(pts, "94063", "00000"), null);
assert.equal(driveMinutesBetween(pts, null, "94611"), null);
assert.equal(driveMinutesBetween(pts, "94063", undefined), null);
console.log("✓ unknown ZIP codes give null, never a number");
assert.equal(NEAR_DRIVE_MINUTES, 10);
console.log("All good.");
