import "server-only";
import Stripe from "stripe";
import { sql } from "./db";
import { APP_NAME } from "./product";

// Subscriptions with Stripe. The free trial needs no card; when the business picks a plan it
// goes to Stripe Checkout (monthly or yearly), and Stripe's webhooks keep the business's plan
// up to date. Managing the card, switching plans and cancelling happen in Stripe's portal.
// Needs STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in the server settings; the two prices are
// found (or made, the first time) by their lookup keys, so nothing else has to be copied over.

export const PRICES = {
  month: { lookup: "plan_monthly", cents: 2900 },
  year: { lookup: "plan_yearly", cents: 29000 },
} as const;
export type Interval = keyof typeof PRICES;

export const billingOn = () => !!process.env.STRIPE_SECRET_KEY;

let client: Stripe | null = null;
export function stripe() {
  if (!client) {
    // Tests point the SDK at a local fake (STRIPE_API_BASE=http://127.0.0.1:4546).
    const base = process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
    client = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", base
      ? { host: base.hostname, port: base.port, protocol: base.protocol.replace(":", "") as "http" | "https" }
      : {});
  }
  return client;
}

/** The price for a plan: by its lookup key, made (with the product) the first time. */
async function priceId(interval: Interval): Promise<string> {
  const { lookup, cents } = PRICES[interval];
  const found = await stripe().prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const products = await stripe().products.search({ query: `metadata['app']:'groomer-app'`, limit: 1 }).catch(() => null);
  const product = products?.data[0] ?? await stripe().products.create({ name: APP_NAME, metadata: { app: "groomer-app" } });
  const price = await stripe().prices.create({
    product: product.id, currency: "usd", unit_amount: cents, recurring: { interval }, lookup_key: lookup,
    nickname: interval === "month" ? "Monthly" : "Yearly",
  });
  return price.id;
}

type BillingBusiness = { id: string; name: string; email: string | null; stripe_customer_id: string | null; trial_ends_at: Date | null };

async function businessFor(businessId: string): Promise<BillingBusiness> {
  const [b] = await sql<BillingBusiness[]>`
    select b.id, b.name, u.email, b.stripe_customer_id, b.trial_ends_at
    from businesses b
    left join lateral (select s.user_id from staff s where s.business_id = b.id and s.role = 'owner' order by s.created_at limit 1) o on true
    left join users u on u.id = o.user_id
    where b.id = ${businessId}`;
  return b;
}

async function customerFor(b: BillingBusiness) {
  if (b.stripe_customer_id) return b.stripe_customer_id;
  const customer = await stripe().customers.create({ name: b.name, email: b.email ?? undefined, metadata: { business_id: b.id } });
  await sql`update businesses set stripe_customer_id = ${customer.id} where id = ${b.id}`;
  return customer.id;
}

/**
 * A Stripe Checkout page for a plan. Picking a plan during the free trial keeps the trial: the
 * first charge is when it ends.
 */
export async function checkoutUrl(
  businessId: string, interval: Interval, appUrl: string,
  // A referral or discount code (see discounts.ts); by default Stripe shows its own code box.
  discount: { discounts: Stripe.Checkout.SessionCreateParams.Discount[] } | { allow_promotion_codes: true } = { allow_promotion_codes: true },
) {
  const b = await businessFor(businessId);
  const [customer, price] = await Promise.all([customerFor(b), priceId(interval)]);
  const trialLeft = b.trial_ends_at && b.trial_ends_at.getTime() > Date.now() + 48 * 3600_000;
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: b.id,
    line_items: [{ price, quantity: 1 }],
    ...discount,
    subscription_data: {
      metadata: { business_id: b.id },
      ...(trialLeft ? { trial_end: Math.floor(b.trial_ends_at!.getTime() / 1000) } : {}),
    },
    success_url: `${appUrl}/billing?done=1`,
    cancel_url: `${appUrl}/billing`,
  });
  return session.url;
}

/** Stripe's portal: card, invoices, switch plans, cancel. */
export async function portalUrl(businessId: string, appUrl: string) {
  const b = await businessFor(businessId);
  if (!b.stripe_customer_id) return null;
  const session = await stripe().billingPortal.sessions.create({ customer: b.stripe_customer_id, return_url: `${appUrl}/billing` });
  return session.url;
}

/** A Stripe subscription → the business's plan. Called from the webhook. */
export async function applySubscription(sub: Stripe.Subscription) {
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const item = sub.items.data[0];
  const price = item?.price;
  const status =
    sub.status === "active" || sub.status === "trialing" ? "active"
      : sub.status === "past_due" || sub.status === "unpaid" ? "past_due"
        : sub.status === "canceled" || sub.status === "incomplete_expired" ? "cancelled"
          : null; // incomplete / paused: leave the plan as it is until Stripe settles it
  if (!status) return;
  const businessId = sub.metadata?.business_id ?? null;
  await sql`
    update businesses set
      plan_status = ${status},
      stripe_customer_id = coalesce(stripe_customer_id, ${customer}),
      stripe_subscription_id = ${sub.id},
      plan_interval = ${price?.recurring?.interval ?? null},
      plan_amount_cents = ${price?.unit_amount ?? null},
      plan_currency = ${price?.currency ? price.currency.toUpperCase() : null},
      plan_period_end = ${item?.current_period_end ? new Date(item.current_period_end * 1000) : null},
      plan_cancel_at_period_end = ${!!sub.cancel_at_period_end},
      cancelled_at = case when ${status} = 'cancelled' then coalesce(cancelled_at, now()) else null end
    where stripe_customer_id = ${customer} or (${businessId}::uuid is not null and id = ${businessId}::uuid)`;
}

export type Access = {
  /** The app opens only the billing page. */
  locked: boolean;
  status: string;
  trialDaysLeft: number | null;
};

/** What the business may do now: trial and courtesy and paying accounts are open. */
export function accessOf(b: { plan_status: string; trial_ends_at: Date | null }, now = Date.now()): Access {
  const days = b.trial_ends_at ? Math.ceil((b.trial_ends_at.getTime() - now) / 86_400_000) : null;
  if (b.plan_status === "active" || b.plan_status === "free") return { locked: false, status: b.plan_status, trialDaysLeft: null };
  if (b.plan_status === "past_due") return { locked: false, status: "past_due", trialDaysLeft: null }; // Stripe retries; a banner asks to fix the card
  if (b.plan_status === "trial") return { locked: days != null && days <= 0, status: "trial", trialDaysLeft: Math.max(0, days ?? 0) };
  return { locked: true, status: b.plan_status, trialDaysLeft: null };
}
