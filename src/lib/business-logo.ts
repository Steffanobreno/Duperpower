import "server-only";
import { sql } from "./db";
import { sniff } from "./pet-photos";
import { hasBuiltInArtwork } from "./product";

/** Saves (or replaces) the business logo. Returns an error message, or null when saved. */
export async function saveLogo(businessId: string, bytes: Uint8Array) {
  if (bytes.length === 0) return "That picture is empty.";
  if (bytes.length > 1_000_000) return "That picture is too big.";
  const type = sniff(bytes);
  // JPEG and PNG only: receipts (PDF) can embed those.
  if (type !== "image/png" && type !== "image/jpeg") return "Use a PNG or JPEG picture.";
  await sql`
    insert into business_logos (business_id, content_type, data) values (${businessId}, ${type}, ${Buffer.from(bytes)})
    on conflict (business_id) do update set content_type = excluded.content_type, data = excluded.data, updated_at = now()`;
  return null;
}

/** The logo's address with a version that changes when it does, or null when there is none. */
export async function logoUrl(businessId: string) {
  const [r] = await sql<{ v: string }[]>`select extract(epoch from updated_at)::bigint::text as v from business_logos where business_id = ${businessId}`;
  return r ? `/logo/${businessId}?v=${r.v}` : null;
}

/** The logo bytes and type, for PDFs and emails. */
export async function logoBytes(businessId: string) {
  const [r] = await sql<{ content_type: string; data: Buffer }[]>`select content_type, data from business_logos where business_id = ${businessId}`;
  return r ? { type: r.content_type, data: new Uint8Array(r.data) } : null;
}

/** The logo to put on top of emails: the uploaded one, the built-in one of the first business, or none. */
export async function emailLogo(businessId: string, businessName: string) {
  return (await logoUrl(businessId)) ?? (hasBuiltInArtwork(businessName) ? "/logo.png" : null);
}
