// After booking, the client is told the time is an estimate and, with an arrival window, that the
// time shown is a window. Usage: npx tsx tests/arrival-note.test.mjs
import assert from "node:assert/strict";
import { withArrivalNote } from "../src/lib/arrival-note.ts";

const body = "Hi Ana! Your appointment is booked for Mon, Dec 1 at 10:00 AM – 10:45 AM.";

// With a window: says it's an arrival window and why.
const w = withArrivalNote(body, "booked", 0, 45);
assert.ok(w.startsWith(body));
assert.match(w, /arrival window/);
assert.match(w, /estimate/);

// No window: only that the time is an estimate.
const n = withArrivalNote(body, "request_received", 0, 0);
assert.match(n, /estimate/);
assert.doesNotMatch(n, /arrival window/);

// Other messages are left alone.
assert.equal(withArrivalNote(body, "reminder", 0, 45), body);
assert.equal(withArrivalNote(body, "cancelled", 30, 30), body);

// An owner text that already explains it isn't repeated.
const own = "Booked for 10:00 AM – 10:45 AM. That's your arrival window.";
assert.equal(withArrivalNote(own, "booked", 0, 45), own);
const own2 = "Booked for 10:00 AM (an estimate).";
assert.equal(withArrivalNote(own2, "booked", 0, 0), own2);

console.log("arrival-note: all good");
