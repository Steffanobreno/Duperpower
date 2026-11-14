// driveMinutes: the free drive-time estimate from straight-line miles.
// Usage: npx tsx --conditions=react-server tests/drive.test.mjs  (drive.ts wraps postal.ts, which is server-only)
import assert from "node:assert/strict";
import { driveMinutes, driveMinutesBetween, driveRuleApplies, NEAR_DRIVE_MINUTES, slotWithinDrive } from "../src/lib/geo/drive.ts";

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

// slotWithinDrive: the stop before and the stop after, each within the limit.
pts.set("94402", { lat: 37.55, lng: -122.3, city: "San Mateo" });
const h = (n) => Date.UTC(2026, 10, 24, n);
const stop = (from, to, zip) => ({ start_at: new Date(h(from)), end_at: new Date(h(to)), zip });
const rwc = stop(9, 11, "94063");
const pied = stop(14, 16, "94611");
assert.equal(slotWithinDrive(pts, "94402", [rwc], h(11), h(12), 35), true);
assert.equal(slotWithinDrive(pts, "94611", [rwc], h(11), h(12), 35), false, "the stop before is too far");
assert.equal(slotWithinDrive(pts, "94611", [rwc], h(7), h(8), 35), false, "the stop after is too far");
assert.equal(slotWithinDrive(pts, "94402", [rwc, pied], h(11), h(12), 35), false, "between two far stops");
assert.equal(slotWithinDrive(pts, "94402", [rwc, pied], h(7), h(8), 35), true);
console.log("✓ a time needs both the stop before and the stop after within the limit");
// Several stops on each side: only the latest one before and the earliest one after count.
assert.equal(slotWithinDrive(pts, "94402", [stop(7, 8, "94063"), stop(9, 10, "94611")], h(11), h(12), 35), false, "9–10 is the stop before");
assert.equal(slotWithinDrive(pts, "94402", [stop(7, 8, "94611"), stop(9, 10, "94063")], h(11), h(12), 35), true, "the far 7–8 stop is not next to 11");
assert.equal(slotWithinDrive(pts, "94402", [stop(13, 14, "94611"), stop(15, 16, "94063")], h(11), h(12), 35), false, "13–14 is the stop after");
assert.equal(slotWithinDrive(pts, "94402", [stop(15, 16, "94611"), stop(13, 14, "94063")], h(11), h(12), 35), true, "the far 15–16 stop is not next to 11");
console.log("✓ with several stops, the latest before and the earliest after are the ones checked");
assert.equal(slotWithinDrive(pts, "94611", [], h(7), h(8), 35), true, "an empty day has nothing to check");
assert.equal(slotWithinDrive(pts, "94402", [stop(9, 11, "99999")], h(7), h(8), 35), false);
assert.equal(slotWithinDrive(pts, "94402", [stop(9, 11, null)], h(11), h(12), 35), false);
console.log("✓ an empty day is open; a stop at an unknown ZIP blocks");

// driveRuleApplies: outside the US, a client code that can't be placed skips the drive rule.
const br = new Map([["01310100", { lat: -23.56, lng: -46.65, city: "São Paulo" }], ["99999999", null]]);
assert.equal(driveRuleApplies(br, "01310-100", "BR"), true, "a placed code (typed with a dash) gets the rule");
assert.equal(driveRuleApplies(br, "99999-999", "BR"), false, "known to be unplaceable");
assert.equal(driveRuleApplies(br, "22222-222", "BR"), false, "never looked up");
assert.equal(driveRuleApplies(pts, "00000", "US"), true, "the US stays fail-closed");
assert.equal(driveRuleApplies(pts, "94611", "US"), true);
console.log("✓ outside the US a client code that can't be placed skips the drive rule; the US never does");
console.log("All good.");
