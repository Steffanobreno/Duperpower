import { sql } from "@/lib/db";

// A cut's photo on the owner's report card. The report token is the key: only a groom of that
// token's visit is served.
export async function GET(_: Request, ctx: RouteContext<"/g/[token]/photo/[groomId]">) {
  const { token, groomId } = await ctx.params;
  if (!/^[0-9a-f]{32}$/.test(token) || !/^[0-9a-f-]{36}$/.test(groomId)) return new Response("Not found", { status: 404 });
  const [g] = await sql<{ photo_type: string; photo: Buffer }[]>`
    select g.photo_type, g.photo from pet_grooms g
    join appointment_pets ap on ap.id = g.appointment_pet_id join appointments a on a.id = ap.appointment_id
    where g.id = ${groomId} and a.report_token = ${token} and g.photo is not null`;
  if (!g) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(g.photo), {
    headers: { "Content-Type": g.photo_type, "Cache-Control": "private, max-age=3600" },
  });
}
