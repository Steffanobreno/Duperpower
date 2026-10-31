import { getStaff } from "@/lib/auth";
import { sql } from "@/lib/db";

// The photo of a cut, for the team's screens only.
export async function GET(_: Request, ctx: RouteContext<"/api/grooms/[id]/photo">) {
  const staff = await getStaff();
  if (!staff) return new Response("Not logged in", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const [g] = await sql<{ photo_type: string; photo: Buffer }[]>`
    select g.photo_type, g.photo from pet_grooms g join pets p on p.id = g.pet_id join clients c on c.id = p.client_id
    where g.id = ${id} and c.business_id = ${staff.businessId} and g.photo is not null`;
  if (!g) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(g.photo), {
    headers: { "Content-Type": g.photo_type, "Cache-Control": "private, max-age=86400" },
  });
}
