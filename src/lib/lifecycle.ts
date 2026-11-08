import "server-only";
import { sql } from "./db";
import { billingOn, isFakeId, PRICES, stripe, stripeOn } from "./billing";
import { chargeCents, type FakeDiscount } from "./fake-payments";
import { emailConfigured, sendEmail } from "./email";
import { isLang, makeT } from "./i18n";
import { OWNER_MESSAGES } from "./i18n/owner";
import { APP_NAME } from "./product";

// Emails about the account itself, to the business owner, each kind once (lifecycle_emails):
// - first_visit: 2 to 7 days after signing up, nothing booked yet → how to book the first visit.
// - trial_3d / trial_1d / trial_ended: the free trial is ending (only with billing on, and only
//   for a business that hasn't chosen a plan yet).
// - first_charge_3d: a plan was chosen during the trial (kept, so the first charge is when it ends),
//   the trial ends in 1 to 3 days → the date and amount of the first charge.
// - yearly_renewal_15d:<period end date>: a yearly plan that renews in 13 to 15 days and isn't
//   cancelled → the renewal date and amount. The period end is in the kind, so it's once per period.
// Run by the hourly job (/api/cron/messages).

type Owner = {
  id: string; name: string; booking_slug: string; email: string; language: string | null;
  trial_ends_at?: Date | null; plan_period_end?: Date | null; plan_amount_cents?: number | null;
  plan_interval?: string | null; stripe_subscription_id?: string | null; fake_plan_discount?: FakeDiscount | null;
  /** The real next charge in cents (discounts included), or null when it can't be told. */
  charge_cents?: number | null;
};
type Kind = "first_visit" | "trial_3d" | "trial_1d" | "trial_ended" | "first_charge_3d" | `yearly_renewal_15d:${string}`;

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function runLifecycleEmails() {
  if (!emailConfigured()) return 0;
  const due = await sql<(Owner & { kind: Kind })[]>`
    with o as (
      select b.id, b.name, b.booking_slug, b.created_at, b.plan_status, b.trial_ends_at, b.stripe_subscription_id,
             b.plan_interval, b.plan_period_end, b.plan_amount_cents, b.plan_cancel_at_period_end, b.fake_plan_discount, u.email, s.language
      from businesses b
      join lateral (select user_id, language from staff where business_id = b.id and role = 'owner' order by created_at limit 1) s on true
      join users u on u.id = s.user_id
      where b.plan_status in ('trial', 'active', 'free'))
    select id, name, booking_slug, email, language, trial_ends_at, plan_period_end, plan_amount_cents, plan_interval,
           stripe_subscription_id, fake_plan_discount, kind from (
      select o.*, case
        -- A plan chosen with more than 48 hours of trial left: active, its period starts at the trial's
        -- end (a plan chosen later is charged at once, and its period ends a month or a year on).
        when plan_status = 'active' and stripe_subscription_id is not null and not plan_cancel_at_period_end
             and plan_period_end <= trial_ends_at + interval '1 hour'
             and trial_ends_at between now() + interval '1 day' and now() + interval '3 days' then 'first_charge_3d'
        when plan_status = 'active' and plan_interval = 'year' and not plan_cancel_at_period_end
             and plan_period_end between now() + interval '13 days' and now() + interval '15 days'
             then 'yearly_renewal_15d:' || to_char(plan_period_end at time zone 'UTC', 'YYYY-MM-DD')
        when ${billingOn()} and plan_status = 'trial' and stripe_subscription_id is null
             and trial_ends_at between now() - interval '3 days' and now() then 'trial_ended'
        when ${billingOn()} and plan_status = 'trial' and stripe_subscription_id is null
             and trial_ends_at between now() and now() + interval '1 day' then 'trial_1d'
        when ${billingOn()} and plan_status = 'trial' and stripe_subscription_id is null
             and trial_ends_at between now() + interval '1 day' and now() + interval '3 days' then 'trial_3d'
        when created_at between now() - interval '7 days' and now() - interval '2 days'
             and not exists (select 1 from appointments a where a.business_id = o.id) then 'first_visit'
      end as kind from o) x
    where kind is not null
      and not exists (select 1 from lifecycle_emails l where l.business_id = x.id and l.kind = x.kind)
    limit 200`;
  let sent = 0;
  for (const o of due) {
    const [claimed] = await sql`insert into lifecycle_emails (business_id, kind) values (${o.id}, ${o.kind})
                                on conflict do nothing returning kind`;
    if (!claimed) continue;
    try {
      const charge_cents = o.kind === "first_charge_3d" || o.kind.startsWith("yearly_renewal_15d") ? await nextChargeCents(o) : undefined;
      await sendEmail({ to: o.email, fromName: APP_NAME, ...lifecycleEmail({ ...o, charge_cents }) });
      sent++;
    } catch (e) {
      console.error("lifecycle email failed", o.kind, e);
      await sql`delete from lifecycle_emails where business_id = ${o.id} and kind = ${o.kind}`;
    }
  }
  return sent;
}

/**
 * What the next charge really is, discounts included: the test mode computes it as its own
 * renewals do; Stripe is asked for the upcoming invoice. null when it can't be told.
 */
async function nextChargeCents(o: Owner): Promise<number | null> {
  try {
    if (isFakeId(o.stripe_subscription_id ?? null)) {
      return o.plan_amount_cents ? chargeCents(o.plan_amount_cents, o.fake_plan_discount ?? null) : null;
    }
    if (!stripeOn() || !o.stripe_subscription_id) return null;
    // A slow or failing Stripe must not hold up the hourly job: one try, 5 seconds at most.
    const preview = await stripe().invoices.createPreview({ subscription: o.stripe_subscription_id }, { timeout: 5000, maxNetworkRetries: 0 });
    return typeof preview.amount_due === "number" ? preview.amount_due : null;
  } catch (e) {
    console.error("upcoming invoice failed", o.id, e);
    return null;
  }
}

/** The email for one kind, in the owner's language. */
export function lifecycleEmail(o: Owner & { kind: Kind }) {
  const t = makeT(OWNER_MESSAGES[isLang(o.language) ? o.language : "en"]);
  const app = APP_NAME;
  const help = t("Need help? Open Help in the app.");
  const money = (cents: number) => `US$${(cents / 100).toFixed(2)}`;
  const day = (d: Date) => d.toLocaleDateString(isLang(o.language) ? o.language : "en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  if (o.kind === "first_visit") {
    return {
      subject: t("Book your first visit in {app}", { app }),
      text: [t("Add a client and book their next visit, or share your booking link so clients book themselves:"),
        `${appUrl()}/book/${o.booking_slug}`, `${appUrl()}/today`, help].join("\n\n"),
    };
  }
  if (o.kind === "first_charge_3d" || o.kind.startsWith("yearly_renewal_15d")) {
    const first = o.kind === "first_charge_3d";
    const date = day((first ? o.trial_ends_at : o.plan_period_end) as Date);
    const subject = first ? t("Your {app} first charge is on {date}", { app, date }) : t("Your {app} yearly plan renews on {date}", { app, date });
    const charge = o.charge_cents;
    const amount = typeof charge === "number" ? money(charge) : null;
    const interval = o.plan_interval === "year" ? "year" : "month";
    // Without a known amount: the plan price and "less any discount", never a figure that may be wrong.
    const priceInfo = { date, price: money(o.plan_amount_cents ?? PRICES[interval].cents), interval: interval === "year" ? t("/year") : t("/month") };
    return {
      subject,
      text: [amount
        ? (first
          ? t("Your free trial ends on {date}. On that day we will charge {amount} for the plan you chose. To avoid the charge, cancel before then on the Plan page:", { date, amount })
          : t("Your yearly plan renews automatically on {date} for {amount}. To stop the renewal, cancel before then on the Plan page; you keep access until the end of the period you paid for:", { date, amount }))
        : (first
          ? t("Your plan starts on {date}. The plan price is {price}{interval}, less any discount you applied. To avoid the charge, cancel before then on the Plan page:", priceInfo)
          : t("Your yearly plan renews on {date}. The plan price is {price}{interval}, less any discount you applied. To stop the renewal, cancel before then on the Plan page:", priceInfo)),
      `${appUrl()}/billing`, help].join("\n\n"),
    };
  }
  if (o.kind === "trial_ended") {
    return {
      subject: t("Your {app} free trial has ended", { app }),
      text: [t("Your clients and visits are safe. Choose a plan to open the app and your booking page again:"),
        `${appUrl()}/billing`, help].join("\n\n"),
    };
  }
  return {
    subject: o.kind === "trial_1d" ? t("Your {app} free trial ends tomorrow", { app }) : t("Your {app} free trial ends in 3 days", { app }),
    text: [t("Choose a plan to keep your calendar, reminders and booking page working. Your data stays as it is:"),
      `${appUrl()}/billing`, help].join("\n\n"),
  };
}
