import "server-only";
import type Stripe from "stripe";
import { sql } from "./db";
import { PRICES, stripe } from "./billing";

// Referrals and discount codes.
// - Referral: every business has a code (and a /signup?ref=<code> link). A business that signs up
//   with it, or types it on the plan page, gets its first month free (US$29 off the first bill);
//   the business that referred it gets US$29 of credit once the new one pays its first bill.
// - Discount codes: made by the app owner in /admin; each is a Stripe coupon with a promotion code.

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

export type CheckoutDiscount =
  | { discounts: Stripe.Checkout.SessionCreateParams.Discount[] }
  | { allow_promotion_codes: true }
  | { error: string };

/**
 * What discount the plan's Checkout gets: the code typed on the plan page (a referral code or
 * a discount code), else the referral the business signed up with (once), else Stripe's own
 * "Add promotion code" box.
 */
export async function discountForCheckout(businessId: string, rawCode: unknown): Promise<CheckoutDiscount> {
  const code = cleanCode(rawCode);
  if (code) {
    const [d] = await sql<{ stripe_promotion_code_id: string }[]>`
      select stripe_promotion_code_id from discount_codes
      where code = ${code} and active and (expires_at is null or expires_at > now())`;
    if (d) return { discounts: [{ promotion_code: d.stripe_promotion_code_id }] };
    const [own] = await sql`select 1 from businesses where id = ${businessId} and referral_code = ${code}`;
    if (own) return { error: "That's your own referral code: share it with other groomers." };
    if (!(await recordReferral(businessId, code))) {
      const [already] = await sql`select 1 from businesses where id = ${businessId} and referred_by is not null`;
      if (!already) return { error: "That code doesn't exist or has expired." };
    }
  }
  // Referred and not paying yet: the free first month (a later new plan doesn't get it again).
  const [r] = await sql`
    select 1 from referrals r join businesses b on b.id = r.referred_id
    where r.referred_id = ${businessId} and b.stripe_subscription_id is null`;
  if (r) return { discounts: [{ coupon: await referralCoupon() }] };
  return { allow_promotion_codes: true };
}

/**
 * A business paid a bill (Stripe's invoice.paid): if it was referred, the referrer gets its
 * credit, once. The credit is taken off the referrer's next bills by Stripe.
 */
export async function rewardReferral(customer: string, amountPaid: number) {
  if (amountPaid <= 0) return;
  const [r] = await sql<{ id: string; referrer_id: string }[]>`
    update referrals set rewarded_at = now(), reward_cents = ${REFERRAL_CENTS}
    where rewarded_at is null and referred_id = (select id from businesses where stripe_customer_id = ${customer})
    returning id, referrer_id`;
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

/** The referrer's Stripe customer (made now if it never chose a plan). */
async function customerOf(businessId: string) {
  const [b] = await sql<{ name: string; stripe_customer_id: string | null; email: string | null }[]>`
    select b.name, b.stripe_customer_id, u.email from businesses b
    left join lateral (select s.user_id from staff s where s.business_id = b.id and s.role = 'owner' order by s.created_at limit 1) o on true
    left join users u on u.id = o.user_id
    where b.id = ${businessId}`;
  if (b.stripe_customer_id) return b.stripe_customer_id;
  const c = await stripe().customers.create({ name: b.name, email: b.email ?? undefined, metadata: { business_id: businessId } });
  await sql`update businesses set stripe_customer_id = coalesce(stripe_customer_id, ${c.id}) where id = ${businessId}`;
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
  const [d] = await sql<{ stripe_promotion_code_id: string }[]>`select stripe_promotion_code_id from discount_codes where id = ${id} and active`;
  if (!d) return;
  await stripe().promotionCodes.update(d.stripe_promotion_code_id, { active: false });
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
