import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";
import { addDaysYmd, dayRangeUtc, hm, ymd } from "../format";

export type TimeOff = { id: string; start_at: Date; end_at: Date; reason: string | null; series_id: string | null };

/** Blocks that touch the days from `from`, `count` days long. */
export function listTimeOff(staff: StaffContext, from: string, count: number) {
  const start = dayRangeUtc(from, staff.timezone).start;
  const end = dayRangeUtc(addDaysYmd(from, count - 1), staff.timezone).end;
  return sql<TimeOff[]>`
    select id, start_at, end_at, reason, series_id from time_off
    where staff_id = ${staff.staffId} and start_at < ${end} and end_at > ${start}
    order by start_at`;
}

export async function getTimeOff(staff: StaffContext, id: string) {
  const [row] = await sql<TimeOff[]>`
    select id, start_at, end_at, reason, series_id from time_off where id = ${id} and staff_id = ${staff.staffId}`;
  return row ?? null;
}

/** A block from midnight to midnight (or longer) is shown as "All day". */
export const isAllDay = (t: { start_at: Date; end_at: Date }, tz: string) =>
  hm(t.start_at, tz) === "00:00" && hm(t.end_at, tz) === "00:00" && ymd(t.end_at, tz) > ymd(t.start_at, tz);
