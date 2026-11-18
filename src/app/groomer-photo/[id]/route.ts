import { sql } from "@/lib/db";

// A groomer's photo, public: clients see it on the booking page.
export async function GET(_: Request, ctx: RouteContext<"/groomer-photo/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const [photo] = await sql<{ content_type: string; data: Buffer }[]>`
    select content_type, data from staff_photos where staff_id = ${id}`;
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: { "Content-Type": photo.content_type, "Cache-Control": "public, max-age=86400" },
  });
}
