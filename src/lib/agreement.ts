import "server-only";
import { headers } from "next/headers";
import type { TransactionSql } from "postgres";
import { sql } from "./db";
import { money } from "./format";

// The service agreement: `agreements` holds the current text and options; every text it ever had
// is kept in `agreement_versions` (never changed), and each signature points to the version signed.

export type Agreement = {
  id: string; title: string; body: string; version: number; required_online: boolean; sign_every_booking: boolean;
  /** Signatures of older versions no longer count (the owner asked everyone to sign again). */
  resign_from_version: number;
  /** Fills {no_show_fee} in the text (null: "a fee"). */
  no_show_fee_cents: number | null;
};

export async function activeAgreement(businessId: string) {
  const [a] = await sql<Agreement[]>`
    select id, title, body, version, required_online, sign_every_booking, resign_from_version, no_show_fee_cents from agreements
    where business_id = ${businessId} and active order by created_at desc limit 1`;
  return a ?? null;
}

/**
 * The client's latest signature that still counts, if any: of a version from `resign_from_version`
 * on, within the last 12 months.
 */
export async function currentSignature(agreement: Agreement, clientId: string) {
  const [s] = await sql<{ signed_at: Date; signed_name: string; signature_url: string | null; agreement_version: number }[]>`
    select signed_at, signed_name, signature_url, agreement_version from agreement_signatures
    where agreement_id = ${agreement.id} and agreement_version >= ${agreement.resign_from_version} and client_id = ${clientId}
      and signed_at > now() - interval '365 days'
    order by signed_at desc limit 1`;
  return s ?? null;
}

/** How many clients have a signature that still counts (same rule as currentSignature). */
export async function countSigned(agreement: Agreement) {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(distinct client_id)::int as n from agreement_signatures
    where agreement_id = ${agreement.id} and agreement_version >= ${agreement.resign_from_version}
      and signed_at > now() - interval '365 days'`;
  return n;
}

/**
 * The text of one kept version of an agreement (what a signature of it signed). `backfilled`: made
 * from the text the agreement had when versions started being kept (migration 0050), so a signature
 * of it may have been of an earlier text.
 */
export async function agreementVersion(agreementId: string, version: number) {
  const [v] = await sql<{ title: string; body: string; no_show_fee_cents: number | null; backfilled: boolean }[]>`
    select title, body, no_show_fee_cents, backfilled from agreement_versions where agreement_id = ${agreementId} and version = ${version}`;
  return v ?? null;
}

/**
 * What {no_show_fee} reads as in the text: the amount in the page's currency, or `noAmount`
 * ("a fee", in the reader's language) when the owner left it empty.
 */
export const noShowFeeText = (cents: number | null, noAmount: string) => (cents == null ? noAmount : money(cents));

/** A drawn signature from the booking page: a small PNG as a data URL, or null if it isn't one. */
export function signatureImage(dataUrl: unknown) {
  return typeof dataUrl === "string" && dataUrl.startsWith("data:image/png;base64,") && dataUrl.length < 300_000 ? dataUrl : null;
}

/**
 * The version a signature is of: `shown`, the version the page showed (from the form), when it
 * still counts: a kept version of this agreement from `resign_from_version` up to the current one.
 * null otherwise (missing, made up, or no longer counting after "sign again"): the client has to
 * read the current text and sign again.
 */
export async function signableVersion(agreement: Agreement, shown: unknown) {
  const asked = typeof shown === "string" && /^\d+$/.test(shown) ? Number(shown) : shown;
  if (typeof asked !== "number" || !Number.isInteger(asked)) return null;
  if (asked < agreement.resign_from_version || asked > agreement.version) return null;
  return (await agreementVersion(agreement.id, asked)) ? asked : null;
}

/** Records a signature of `version`, one signableVersion() accepted. */
export async function recordSignature(
  tx: TransactionSql | typeof sql,
  agreement: Agreement,
  clientId: string,
  name: string,
  drawn: string | null,
  version: number,
) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
  await tx`insert into agreement_signatures (agreement_id, agreement_version, client_id, signed_name, signature_url, ip)
           values (${agreement.id}, ${version}, ${clientId}, ${name.slice(0, 120)}, ${drawn}, ${ip})`;
}
