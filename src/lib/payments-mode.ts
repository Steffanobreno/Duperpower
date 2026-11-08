// Which payment provider the app uses (re-exported by billing.ts; kept apart so it has no
// server-only imports and a plain script can test it).
// - "stripe": STRIPE_SECRET_KEY is set. Real charges.
// - "fake": no Stripe key, and not production (or FAKE_PAYMENTS=1): TEST mode, plans are paid on
//   an internal page with no real charge, so the whole flow can be tried before Stripe exists.
// - "off": production without Stripe and without the flag. Nobody pays and nothing locks.
export type PaymentsMode = "stripe" | "fake" | "off";

export function paymentsMode(env: Record<string, string | undefined> = process.env): PaymentsMode {
  if (env.STRIPE_SECRET_KEY) return "stripe";
  if (env.NODE_ENV !== "production" || env.FAKE_PAYMENTS === "1") return "fake";
  return "off";
}

/**
 * Picking a plan during the free trial keeps the trial (the first charge is when it ends), unless
 * fewer than 48 hours of it are left.
 */
export const keepsTrial = (trialEndsAt: Date | null, now = Date.now()) =>
  !!trialEndsAt && trialEndsAt.getTime() > now + 48 * 3600_000;
