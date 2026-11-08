import type Stripe from "stripe";
import { applySubscription, stripe, stripeOn } from "@/lib/billing";
import { rewardReferral } from "@/lib/discounts";

// Stripe tells the app about subscriptions here (Stripe Dashboard → Developers → Webhooks,
// endpoint <APP_URL>/api/stripe/webhook; events: checkout.session.completed, customer.subscription.*,
// invoice.paid). Each event is checked against STRIPE_WEBHOOK_SECRET.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeOn() || !secret) return new Response("Billing is not set up", { status: 503 });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(body, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription) {
        const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        await applySubscription(await stripe().subscriptions.retrieve(id));
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      // Stripe may deliver events late or out of order (an old "updated" after "deleted"),
      // so the plan follows the subscription as it is now, not the event's copy of it.
      await applySubscription(await stripe().subscriptions.retrieve(event.data.object.id));
      break;
    case "invoice.paid": {
      // A referred business paid a real bill: the one that referred it gets its credit (once).
      const invoice = event.data.object;
      const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (customer) await rewardReferral(customer, invoice.amount_paid);
      break;
    }
  }
  return Response.json({ received: true });
}
