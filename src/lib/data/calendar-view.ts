import "server-only";
import { sql } from "../db";

export type CalendarView = {
  show_client: boolean; show_pets: boolean; show_services: boolean; show_address: boolean; show_notes: boolean;
  view_start: string | null; view_end: string | null; color_by: "status" | "staff" | "service";
};

export async function calendarView(businessId: string): Promise<CalendarView> {
  const [v] = await sql<CalendarView[]>`
    select cal_show_client as show_client, cal_show_pets as show_pets, cal_show_services as show_services,
           cal_show_address as show_address, cal_show_notes as show_notes,
           to_char(cal_view_start, 'HH24:MI') as view_start, to_char(cal_view_end, 'HH24:MI') as view_end,
           cal_color_by as color_by
    from businesses where id = ${businessId}`;
  return v;
}
