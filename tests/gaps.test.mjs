// freeGaps: working hours minus busy blocks, keeping gaps long enough for a service.
// Usage: npx tsx tests/gaps.test.mjs
import assert from "node:assert/strict";
import { freeGaps } from "../src/lib/gaps.ts";

const hours = { start: "07:00", end: "19:00" };
const busy = [
  { start: "09:00", end: "11:00" },
  { start: "15:00", end: "16:00" },
  { start: "10:30", end: "12:00" }, // overlaps the first, out of order
];

assert.deepEqual(freeGaps(hours, busy, 60), [
  { start: "07:00", end: "09:00", minutes: 120 },
  { start: "12:00", end: "15:00", minutes: 180 },
  { start: "16:00", end: "19:00", minutes: 180 },
]);
console.log("✓ busy blocks are merged and sorted; the free time between them is returned");

assert.deepEqual(freeGaps(null, busy, 60), []);
console.log("✓ a day off has no gaps");

assert.deepEqual(freeGaps(hours, [{ start: "06:00", end: "12:00" }, { start: "12:00", end: "20:00" }], 60), []);
console.log("✓ busy blocks covering the whole day (even past the hours) leave nothing");

assert.deepEqual(freeGaps(hours, busy, 200), []);
assert.deepEqual(freeGaps(hours, busy, 180), [
  { start: "12:00", end: "15:00", minutes: 180 },
  { start: "16:00", end: "19:00", minutes: 180 },
]);
console.log("✓ gaps shorter than the shortest service are dropped");

assert.deepEqual(freeGaps(hours, [{ start: "05:00", end: "08:00" }, { start: "18:00", end: "24:00" }], 60), [
  { start: "08:00", end: "18:00", minutes: 600 },
]);
console.log("✓ busy blocks are clipped to the working hours");

console.log("All good.");
