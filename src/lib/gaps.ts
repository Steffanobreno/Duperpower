// Free time on a day: the working hours minus visits and blocks. Pure (no "server-only"), so
// tests can import it directly. All times are "HH:mm" in the business's time zone.

export type Gap = { start: string; end: string; minutes: number };

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const toHm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** The free stretches inside `hours`, at least `minMinutes` long. No hours (a day off): none. */
export function freeGaps(hours: { start: string; end: string } | null, busy: { start: string; end: string }[], minMinutes: number): Gap[] {
  if (!hours) return [];
  const open = toMin(hours.start);
  const close = toMin(hours.end);
  const blocks = busy
    .map((b) => [Math.max(toMin(b.start), open), Math.min(toMin(b.end), close)] as const)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const gaps: Gap[] = [];
  let from = open;
  for (const [s, e] of blocks) {
    if (s > from) gaps.push({ start: toHm(from), end: toHm(s), minutes: s - from });
    from = Math.max(from, e);
  }
  if (close > from) gaps.push({ start: toHm(from), end: toHm(close), minutes: close - from });
  return gaps.filter((g) => g.minutes >= minMinutes);
}
