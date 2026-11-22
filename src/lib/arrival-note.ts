// The messages a client gets right after booking say the time is an estimate, and with an arrival
// window that the time shown is a window, not an exact start: the visits before theirs can run
// shorter or longer. Added after the owner's own text, unless that text already says so.

const AFTER_BOOKING = new Set(["booked", "request_received"]);

export function withArrivalNote(body: string, trigger: string, beforeMin: number, afterMin: number): string {
  if (!AFTER_BOOKING.has(trigger) || /arrival window|estimate/i.test(body)) return body;
  const note = beforeMin || afterMin
    ? "Please note: the time above is an arrival window, not an exact time. It's an estimate: we'll get to you within that window, since the visits before yours can run shorter or longer."
    : "Please note: the time is an estimate, since the visits before yours can run shorter or longer.";
  return `${body.trimEnd()} ${note}`;
}
