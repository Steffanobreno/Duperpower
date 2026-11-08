import "server-only";
import { addMonths, addYears } from "date-fns";
import { sql } from "./db";
import { applyPlan, keepsTrial, paymentsMode, PRICES, type Interval } from "./billing";
import { BAD_CODE, REFERRAL_CENTS, resolveDiscount, rewardReferralInFino, type DiscountCode } from "./discounts";

// The fake payment gateway (TEST mode: no Stripe key, see payments-mode.ts). It stands in for
// Stripe with the same rules: plans are "paid" on /billing/fake-checkout with no real charge,
// managed on /billing/fake-portal, and renewed (or ended) by the hourly job. The plan itself is
// applied by applyPlan in billing.ts, the same as Stripe's webhook does.

export const fakeOn = () => paymentsMode() === "fake";
export const fakeCustomerId = (businessId: string) => `fake_cus_${businessId}`;
export const fakeSubscriptionId = (businessId: string) => `fake_sub_${businessId}`;

/** What a test subscription keeps of its discount for its next charges (chargesLeft null = forever). */
export type FakeDiscount = { code: string | null; percentOff: number | null; amountOffCents: number | null; chargesLeft: number | null };

/** One bill of `cents` with the discount, if it still has charges left. */
export function chargeCents(cents: number, d: FakeDiscount | null) {
  if (!d || d.chargesLeft === 0) return cents;
  const off = d.percentOff ? Math.round((cents * d.percentOff) / 100) : (d.amountOffCents ?? 0);
  return Math.max(0, cents - off);
}
const afterCharge = (d: FakeDiscount | null): FakeDiscount | null =>
  d && d.chargesLeft != null ? { ...d, chargesLeft: Math.max(0, d.chargesLeft - 1) } : d;
const nextPeriod = (from: Date, interval: Interval) => (interval === "year" ? addYears(from, 1) : addMonths(from, 1));

/** Like Stripe: "once" is the first bill, "repeating" the bills within those months, "forever" all. */
function fromCode(c: DiscountCode, interval: Interval): FakeDiscount {
  const months = c.duration_months ?? 1;
  return {
    code: c.code,
    percentOff: c.percent_off ? Number(c.percent_off) : null,
    amountOffCents: c.amount_off_cents,
    chargesLeft: c.duration === "forever" ? null : c.duration === "once" ? 1 : interval === "year" ? Math.ceil(months / 12) : months,
  };
}

export type FakeQuote = {
  interval: Interval;
  priceCents: number;
  discount: (FakeDiscount & { kind: "referral" | "code"; duration: "once" | "repeating" | "forever"; months: number | null }) | null;
  /** The first bill, with the discount. */
  firstChargeCents: number;
  /** When it's charged: the end of the free trial when it's kept, else null (today). */
  firstChargeAt: Date | null;
};

/** What the test checkout shows, by the same rules as Stripe's Checkout (discountForCheckout, checkoutUrl). */
export async function fakeQuote(businessId: string, interval: Interval, rawCode: unknown): Promise<FakeQuote | { error: string }> {
  const d = await resolveDiscount(businessId, rawCode);
  if ("error" in d) return d;
  let discount: FakeQuote["discount"] = null;
  if ("code" in d) {
    // Stripe refuses a promotion code used up to its limit.
    if (d.code.max_redemptions != null && ((await fakeTimesRedeemed()).get(d.code.code) ?? 0) >= d.code.max_redemptions) return { error: BAD_CODE };
    discount = { ...fromCode(d.code, interval), kind: "code", duration: d.code.duration, months: d.code.duration_months };
  } else if ("referral" in d) {
    discount = { code: null, percentOff: null, amountOffCents: REFERRAL_CENTS, chargesLeft: 1, kind: "referral", duration: "once", months: null };
  }
  const [b] = await sql<{ trial_ends_at: Date | null }[]>`select trial_ends_at from businesses where id = ${businessId}`;
  const priceCents = PRICES[interval].cents;
  return {
    interval, priceCents, discount,
    firstChargeCents: chargeCents(priceCents, discount),
    firstChargeAt: keepsTrial(b.trial_ends_at) ? b.trial_ends_at : null,
  };
}

/**
 * "Pay (test)": the plan starts as Stripe's webhook would start it, and the first bill (when it
 * is today) counts as paid: a referred business's first paid bill gives its referrer the credit.
 */
export async function payFakeCheckout(businessId: string, interval: Interval, rawCode: unknown): Promise<"paid" | "refused" | { error: string }> {
  // Never a free plan outside test mode, nor a second one over a plan already running.
  if (!fakeOn()) return "refused";
  const [open] = await sql`select 1 from businesses where id = ${businessId} and plan_status in ('trial', 'cancelled')`;
  if (!open) return "refused";
  const q = await fakeQuote(businessId, interval, rawCode);
  if ("error" in q) return q;
  const paidNow = !q.firstChargeAt;
  const kept: FakeDiscount | null = q.discount
    ? { code: q.discount.code, percentOff: q.discount.percentOff, amountOffCents: q.discount.amountOffCents, chargesLeft: q.discount.chargesLeft }
    : null;
  const left = paidNow ? afterCharge(kept) : kept;
  await sql`update businesses set fake_plan_discount = ${left ? sql.json(left) : null} where id = ${businessId}`;
  await applyPlan(businessId, {
    status: "active", customer: fakeCustomerId(businessId), subscriptionId: fakeSubscriptionId(businessId),
    interval, amountCents: q.priceCents, currency: "USD",
    periodEnd: q.firstChargeAt ?? nextPeriod(new Date(), interval), cancelAtPeriodEnd: false,
  });
  if (paidNow) await rewardReferralInFino(fakeCustomerId(businessId), q.firstChargeCents);
  return "paid";
}

type FakePlan = { plan_interval: Interval; plan_amount_cents: number; plan_currency: string; plan_period_end: Date; plan_cancel_at_period_end: boolean };

/** The business's active test subscription, or null. */
export async function fakePlanOf(businessId: string): Promise<FakePlan | null> {
  const [b] = await sql<FakePlan[]>`
    select plan_interval, plan_amount_cents, plan_currency, plan_period_end, plan_cancel_at_period_end from businesses
    where id = ${businessId} and stripe_subscription_id = ${fakeSubscriptionId(businessId)} and plan_status = 'active'`;
  return b ?? null;
}

/** The test portal's Cancel at period end / Resume. */
export async function setFakeCancelAtPeriodEnd(businessId: string, cancel: boolean) {
  const b = await fakePlanOf(businessId);
  if (!b) return;
  await applyPlan(businessId, {
    status: "active", customer: fakeCustomerId(businessId), subscriptionId: fakeSubscriptionId(businessId),
    interval: b.plan_interval, amountCents: b.plan_amount_cents, currency: b.plan_currency,
    periodEnd: b.plan_period_end, cancelAtPeriodEnd: cancel,
  });
}

/**
 * The hourly job: test subscriptions whose period is over are renewed (the bill is paid, with
 * what's left of the discount) or, when cancelled at period end, end. Outside test mode they
 * always end: nobody keeps a plan without paying once the fake gateway is off.
 */
export async function runFakeRenewals() {
  const due = await sql<(FakePlan & { id: string; fake_plan_discount: FakeDiscount | null })[]>`
    select id, plan_interval, plan_amount_cents, plan_currency, plan_period_end, plan_cancel_at_period_end, fake_plan_discount
    from businesses
    where plan_status = 'active' and left(stripe_subscription_id, 9) = 'fake_sub_' and plan_period_end <= now()`;
  let renewed = 0;
  for (const b of due) {
    const plan = {
      customer: fakeCustomerId(b.id), subscriptionId: fakeSubscriptionId(b.id),
      interval: b.plan_interval, amountCents: b.plan_amount_cents, currency: b.plan_currency,
    };
    if (b.plan_cancel_at_period_end || !fakeOn()) {
      await applyPlan(b.id, { ...plan, status: "cancelled", periodEnd: b.plan_period_end, cancelAtPeriodEnd: b.plan_cancel_at_period_end });
      continue;
    }
    const left = afterCharge(b.fake_plan_discount);
    // Only if no other run renewed it meanwhile: one bill per period.
    const [won] = await sql`
      update businesses set plan_period_end = ${nextPeriod(b.plan_period_end, b.plan_interval)},
                            fake_plan_discount = ${left ? sql.json(left) : null}
      where id = ${b.id} and plan_status = 'active' and date_trunc('milliseconds', plan_period_end) = ${b.plan_period_end}
      returning id`;
    if (!won) continue;
    renewed++;
    await rewardReferralInFino(fakeCustomerId(b.id), chargeCents(b.plan_amount_cents, b.fake_plan_discount));
  }
  return renewed;
}

/** How many test subscriptions used each discount code (Stripe counts its own: timesRedeemed). */
export async function fakeTimesRedeemed(): Promise<Map<string, number>> {
  const rows = await sql<{ code: string; n: number }[]>`
    select fake_plan_discount->>'code' as code, count(*)::int as n from businesses
    where fake_plan_discount->>'code' is not null group by 1`;
  return new Map(rows.map((r) => [r.code, r.n]));
}
