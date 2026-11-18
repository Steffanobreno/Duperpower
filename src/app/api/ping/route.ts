import { sql } from "@/lib/db";

// Wakes this server and the database (which sleeps after a few idle minutes) when the app comes
// back to the screen, so the groomer's first tap doesn't pay for it. Answers nothing else.
export async function GET() {
  await sql`select 1`.catch(() => null);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
