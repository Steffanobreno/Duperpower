// Which payment provider the app uses (re-exported by billing.ts; kept apart so it has no
// server-only imports and a plain script can test it).
// - "stripe": STRIPE_SECRET_KEY is set. Real charges.
// - "fake": no Stripe key, and either a development/test server or FAKE_PAYMENTS=1: TEST mode,
//   plans are paid on an internal page with no real charge, so the whole flow can be tried
//   before Stripe exists.
// - "off": anything else (production, or an unknown NODE_ENV, without the flag). Nobody pays and
//   nothing locks. It fails closed: only an explicit dev/test server or the flag turns test mode on.
export type PaymentsMode = "stripe" | "fake" | "off";

// NODE_ENV is read as the literal process.env.NODE_ENV (Next inlines it at build time), not from
// `env`; the parameters are there for tests.
export function paymentsMode(
  env: Record<string, string | undefined> = process.env,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): PaymentsMode {
  if (env.STRIPE_SECRET_KEY) return "stripe";
  if (env.FAKE_PAYMENTS === "1" || nodeEnv === "development" || nodeEnv === "test") return "fake";
  return "off";
}

/**
 * Picking a plan during the free trial keeps the trial (the first charge is when it ends), unless
 * fewer than 48 hours of it are left.
 */
export const keepsTrial = (trialEndsAt: Date | null, now = Date.now()) =>
  !!trialEndsAt && trialEndsAt.getTime() > now + 48 * 3600_000;
