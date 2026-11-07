import type Stripe from "stripe";
import { applySubscription, billingOn, stripe } from "@/lib/billing";

// Stripe tells the app about subscriptions here (Stripe Dashboard → Developers → Webhooks,
// endpoint <APP_URL>/api/stripe/webhook). Each event is checked against STRIPE_WEBHOOK_SECRET.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!billingOn() || !secret) return new Response("Billing is not set up", { status: 503 });
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
  }
  return Response.json({ received: true });
}
