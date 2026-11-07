import "server-only";
import { sql } from "./db";
import { billingOn } from "./billing";
import { emailConfigured, sendEmail } from "./email";
import { isLang, makeT } from "./i18n";
import { OWNER_MESSAGES } from "./i18n/owner";
import { APP_NAME } from "./product";

// Emails about the account itself, to the business owner, each kind once (lifecycle_emails):
// - first_visit: 2 to 7 days after signing up, nothing booked yet → how to book the first visit.
// - trial_3d / trial_1d / trial_ended: the free trial is ending (only with billing on, and only
//   for a business that hasn't chosen a plan yet).
// Run by the hourly job (/api/cron/messages).

type Owner = { id: string; name: string; booking_slug: string; email: string; language: string | null };
type Kind = "first_visit" | "trial_3d" | "trial_1d" | "trial_ended";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function runLifecycleEmails() {
  if (!emailConfigured()) return 0;
  const due = await sql<(Owner & { kind: Kind })[]>`
    with o as (
      select b.id, b.name, b.booking_slug, b.created_at, b.plan_status, b.trial_ends_at, b.stripe_subscription_id, u.email, s.language
      from businesses b
      join lateral (select user_id, language from staff where business_id = b.id and role = 'owner' order by created_at limit 1) s on true
      join users u on u.id = s.user_id
      where b.plan_status in ('trial', 'active', 'free'))
    select id, name, booking_slug, email, language, kind from (
      select o.*, case
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
      await sendEmail({ to: o.email, fromName: APP_NAME, ...lifecycleEmail(o) });
      sent++;
    } catch (e) {
      console.error("lifecycle email failed", o.kind, e);
      await sql`delete from lifecycle_emails where business_id = ${o.id} and kind = ${o.kind}`;
    }
  }
  return sent;
}

/** The email for one kind, in the owner's language. */
export function lifecycleEmail(o: Owner & { kind: Kind }) {
  const t = makeT(OWNER_MESSAGES[isLang(o.language) ? o.language : "en"]);
  const app = APP_NAME;
  const help = t("Need help? Open Help in the app.");
  if (o.kind === "first_visit") {
    return {
      subject: t("Book your first visit in {app}", { app }),
      text: [t("Add a client and book their next visit, or share your booking link so clients book themselves:"),
        `${appUrl()}/book/${o.booking_slug}`, `${appUrl()}/today`, help].join("\n\n"),
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
