import "server-only";
import type { Sql, TransactionSql } from "postgres";
import { LEGAL } from "../legal";

/** Writes down that this person accepted the current Terms (version, date and IP are kept). */
export async function recordTermsAcceptance(
  tx: Sql | TransactionSql,
  a: { businessId: string; userId: string | null; context: "signup" | "checkout"; ip: string | null },
): Promise<void> {
  await tx`
    insert into terms_acceptances (business_id, user_id, terms_version, ip, context)
    values (${a.businessId}, ${a.userId}, ${LEGAL.termsVersion}, ${a.ip}, ${a.context})`;
}
