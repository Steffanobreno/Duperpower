import { sql } from "@/lib/db";

// The business logo, public: it shows on the booking page, client links and receipts.
export async function GET(_: Request, ctx: RouteContext<"/logo/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const [logo] = await sql<{ content_type: string; data: Buffer }[]>`
    select content_type, data from business_logos where business_id = ${id}`;
  if (!logo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(logo.data), {
    headers: { "Content-Type": logo.content_type, "Cache-Control": "public, max-age=86400" },
  });
}
