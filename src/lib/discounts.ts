import "server-only";
import type Stripe from "stripe";
import { sql } from "./db";
import { isFakeId, PRICES, stripe, stripeOn } from "./billing";
import { logServerError } from "./error-log";

// Referrals and discount codes.
// - Referral: every business has a code (and a /signup?ref=<code> link). A business that signs up
//   with it, or types it on the plan page, gets its first month free (US$29 off the first bill);
//   the business that referred it gets US$29 of credit once the new one pays its first bill.
// - Discount codes: made by the app owner in /admin; each is a Stripe coupon with a promotion code
//   (in test mode, without Stripe, only the row here: see fake-payments.ts).

export const REFERRAL_CENTS = PRICES.month.cents;
const REFERRAL_COUPON = "fino-referral-month";

/** A business's referral code, made the first time it's needed (e.g. "SUDSY-4821"). */
export async function referralCodeOf(businessId: string): Promise<string> {
  const [b] = await sql<{ referral_code: string | null; booking_slug: string }[]>`
    select referral_code, booking_slug from businesses where id = ${businessId}`;
  if (b.referral_code) return b.referral_code;
  const stem = (b.booking_slug.replace(/[^a-z]/g, "").slice(0, 6) || "FINO").toUpperCase();
  for (let i = 0; i < 10; i++) {
    const code = `${stem}-${String(1000 + Math.floor(Math.random() * 9000))}`;
    const [set] = await sql`update businesses set referral_code = ${code}
                            where id = ${businessId} and referral_code is null
                              and not exists (select 1 from businesses where referral_code = ${code})
                              and not exists (select 1 from discount_codes where code = ${code})
                            returning referral_code`;
    if (set) return set.referral_code;
    const [again] = await sql`select referral_code from businesses where id = ${businessId}`;
    if (again.referral_code) return again.referral_code;
  }
  throw new Error("Could not make a referral code");
}

/**
 * The referral code for the "Online booking by Fino" footer, or null when it can't be read or
 * made. A failure here must never block an email or a client page: it only drops the footer.
 */
export async function safeReferralCode(businessId: string): Promise<string | null> {
  try {
    return await referralCodeOf(businessId);
  } catch (e) {
    await logServerError(e instanceof Error ? e.message : String(e), "referral-code", null).catch(() => {});
    return null;
  }
}

export const cleanCode = (raw: unknown) => String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "").slice(0, 40);

/**
 * Notes that `businessId` was referred by the business whose code this is. False when the code
 * isn't a referral code, is its own, or it was already referred (by anyone).
 */
export async function recordReferral(businessId: string, rawCode: unknown) {
  const code = cleanCode(rawCode);
  if (!/^[A-Z]+-\d{4}$/.test(code)) return false;
  const [referrer] = await sql<{ id: string }[]>`select id from businesses where referral_code = ${code} and id <> ${businessId}`;
  if (!referrer) return false;
  return sql.begin(async (tx) => {
    const [set] = await tx`update businesses set referred_by = ${referrer.id} where id = ${businessId} and referred_by is null returning id`;
    if (!set) return false;
    await tx`insert into referrals (referrer_id, referred_id) values (${referrer.id}, ${businessId}) on conflict (referred_id) do nothing`;
    return true;
  });
}

/** The Stripe coupon for a referred business's free first month (made the first time). */
async function referralCoupon() {
  try {
    return (await stripe().coupons.retrieve(REFERRAL_COUPON)).id;
  } catch {
    const c = await stripe().coupons.create({
      id: REFERRAL_COUPON, name: "Referral: first month free", amount_off: REFERRAL_CENTS, currency: "usd", duration: "once",
    });
    return c.id;
  }
}

export type DiscountCode = {
  id: string; code: string; stripe_promotion_code_id: string | null; percent_off: string | null; amount_off_cents: number | null;
  duration: "once" | "repeating" | "forever"; duration_months: number | null; max_redemptions: number | null;
};

/**
 * The discount a plan gets: the code typed on the plan page (a discount code, or a referral
 * code, which is noted), else the referral the business signed up with (once: a later new plan
 * doesn't get it again), else none. A wrong code, or its own referral code, is an error.
 * Stripe's Checkout (discountForCheckout) and the test mode's checkout both follow it.
 */
export async function resolveDiscount(businessId: string, rawCode: unknown):
  Promise<{ code: DiscountCode } | { referral: true } | { none: true } | { error: string }> {
  const code = cleanCode(rawCode);
  if (code) {
    const [d] = await sql<DiscountCode[]>`
      select id, code, stripe_promotion_code_id, percent_off, amount_off_cents, duration, duration_months, max_redemptions
      from discount_codes
      where code = ${code} and active and (expires_at is null or expires_at > now())`;
    if (d) return { code: d };
    const [own] = await sql`select 1 from businesses where id = ${businessId} and referral_code = ${code}`;
    if (own) return { error: OWN_CODE };
    if (!(await recordReferral(businessId, code))) {
      const [already] = await sql`select 1 from businesses where id = ${businessId} and referred_by is not null`;
      if (!already) return { error: BAD_CODE };
    }
  }
  // Referred and not paying yet: the free first month.
  const [r] = await sql`
    select 1 from referrals r join businesses b on b.id = r.referred_id
    where r.referred_id = ${businessId} and b.stripe_subscription_id is null`;
  return r ? { referral: true } : { none: true };
}

export const OWN_CODE = "That's your own referral code: share it with other groomers.";
export const BAD_CODE = "That code doesn't exist or has expired.";
/** Back to the plan page with the code's error shown (see billing/page.tsx). */
export const codeErrorUrl = (error: string, code: string) =>
  `/billing?code_error=${error === OWN_CODE ? "own" : "bad"}&code=${encodeURIComponent(code)}`;

export type CheckoutDiscount =
  | { discounts: Stripe.Checkout.SessionCreateParams.Discount[] }
  | { allow_promotion_codes: true }
  | { error: string };

/**
 * What discount the plan's Checkout gets (see resolveDiscount); with none, Stripe's own "Add
 * promotion code" box.
 */
export async function discountForCheckout(businessId: string, rawCode: unknown): Promise<CheckoutDiscount> {
  const d = await resolveDiscount(businessId, rawCode);
  if ("error" in d) return d;
  if ("code" in d) {
    // A code made in test mode has no Stripe promotion code: Stripe can't take it.
    return d.code.stripe_promotion_code_id ? { discounts: [{ promotion_code: d.code.stripe_promotion_code_id }] } : { error: BAD_CODE };
  }
  if ("referral" in d) return { discounts: [{ coupon: await referralCoupon() }] };
  return { allow_promotion_codes: true };
}

/**
 * A business paid a bill (Stripe's invoice.paid): if it was referred, the referrer gets its
 * credit, once. The credit is taken off the referrer's next bills by Stripe.
 */
export async function rewardReferral(customer: string, amountPaid: number) {
  const r = await claimReferralReward(customer, amountPaid);
  if (!r) return;
  try {
    const referrerCustomer = await customerOf(r.referrer_id);
    await stripe().customers.createBalanceTransaction(referrerCustomer,
      { amount: -REFERRAL_CENTS, currency: "usd", description: "Referral credit: a groomer you referred joined" },
      { idempotencyKey: `referral-${r.id}` });
  } catch (e) {
    // Not given: try again when Stripe sends the event again.
    await sql`update referrals set rewarded_at = null, reward_cents = null where id = ${r.id}`;
    throw e;
  }
}

/**
 * The same for a test-mode bill: the credit is noted in Fino's own tables only (there is no
 * Stripe balance), so the referrer's plan page shows it.
 */
export async function rewardReferralInFino(customer: string, amountPaid: number) {
  await claimReferralReward(customer, amountPaid);
}

/** Notes the referrer's credit for this paying customer, once (null when it isn't due). */
async function claimReferralReward(customer: string, amountPaid: number) {
  if (amountPaid <= 0) return null;
  const [r] = await sql<{ id: string; referrer_id: string }[]>`
    update referrals set rewarded_at = now(), reward_cents = ${REFERRAL_CENTS}
    where rewarded_at is null and referred_id = (select id from businesses where stripe_customer_id = ${customer})
    returning id, referrer_id`;
  return r ?? null;
}

/** The referrer's Stripe customer (made now if it never chose a plan). */
async function customerOf(businessId: string) {
  const [b] = await sql<{ name: string; stripe_customer_id: string | null; email: string | null }[]>`
    select b.name, b.stripe_customer_id, u.email from businesses b
    left join lateral (select s.user_id from staff s where s.business_id = b.id and s.role = 'owner' order by s.created_at limit 1) o on true
    left join users u on u.id = o.user_id
    where b.id = ${businessId}`;
  if (b.stripe_customer_id && !isFakeId(b.stripe_customer_id)) return b.stripe_customer_id;
  const c = await stripe().customers.create({ name: b.name, email: b.email ?? undefined, metadata: { business_id: businessId } });
  // Kept if another request made one meanwhile; a test-mode id is replaced.
  await sql`update businesses set stripe_customer_id = case when stripe_customer_id is null or left(stripe_customer_id, 5) = 'fake_'
                                                       then ${c.id} else stripe_customer_id end
            where id = ${businessId}`;
  const [after] = await sql`select stripe_customer_id from businesses where id = ${businessId}`;
  return after.stripe_customer_id as string;
}

export type ReferralStats = { code: string; joined: number; rewarded: number; creditCents: number };

export async function referralStats(businessId: string): Promise<ReferralStats> {
  const [code, [s]] = await Promise.all([
    referralCodeOf(businessId),
    sql<{ joined: number; rewarded: number; credit: number }[]>`
      select count(*)::int as joined, count(rewarded_at)::int as rewarded, coalesce(sum(reward_cents), 0)::int as credit
      from referrals where referrer_id = ${businessId}`,
  ]);
  return { code, joined: s.joined, rewarded: s.rewarded, creditCents: s.credit };
}

// ——— Discount codes (the app owner, in /admin) ———

export type NewDiscountCode = {
  code: string; percentOff: number | null; amountOffCents: number | null;
  duration: "once" | "repeating" | "forever"; durationMonths: number | null;
  maxRedemptions: number | null; expiresAt: Date | null; note: string | null;
};

export async function createDiscountCode(d: NewDiscountCode) {
  if (!stripeOn()) {
    // Test mode: the code lives only here (fake-payments.ts applies it).
    await sql`
      insert into discount_codes (code, percent_off, amount_off_cents, duration, duration_months, max_redemptions, expires_at, note)
      values (${d.code}, ${d.percentOff}, ${d.amountOffCents}, ${d.duration}, ${d.durationMonths}, ${d.maxRedemptions}, ${d.expiresAt}, ${d.note})`;
    return;
  }
  const coupon = await stripe().coupons.create({
    name: d.code,
    ...(d.percentOff ? { percent_off: d.percentOff } : { amount_off: d.amountOffCents!, currency: "usd" }),
    duration: d.duration,
    ...(d.duration === "repeating" ? { duration_in_months: d.durationMonths! } : {}),
  });
  const promo = await stripe().promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code: d.code,
    ...(d.maxRedemptions ? { max_redemptions: d.maxRedemptions } : {}),
    ...(d.expiresAt ? { expires_at: Math.floor(d.expiresAt.getTime() / 1000) } : {}),
  });
  await sql`
    insert into discount_codes (code, stripe_coupon_id, stripe_promotion_code_id, percent_off, amount_off_cents, duration,
                                duration_months, max_redemptions, expires_at, note)
    values (${d.code}, ${coupon.id}, ${promo.id}, ${d.percentOff}, ${d.amountOffCents}, ${d.duration},
            ${d.durationMonths}, ${d.maxRedemptions}, ${d.expiresAt}, ${d.note})`;
}

export async function deactivateDiscountCode(id: string) {
  const [d] = await sql<{ stripe_promotion_code_id: string | null }[]>`select stripe_promotion_code_id from discount_codes where id = ${id} and active`;
  if (!d) return;
  if (d.stripe_promotion_code_id && stripeOn()) await stripe().promotionCodes.update(d.stripe_promotion_code_id, { active: false });
  await sql`update discount_codes set active = false where id = ${id}`;
}

/** How many times each promotion code was used, from Stripe (0 when Stripe can't be reached). */
export async function timesRedeemed(): Promise<Map<string, number>> {
  try {
    const list = await stripe().promotionCodes.list({ limit: 100 });
    return new Map(list.data.map((p) => [p.id, p.times_redeemed]));
  } catch {
    return new Map();
  }
}
