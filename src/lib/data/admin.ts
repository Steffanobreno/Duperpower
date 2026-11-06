import "server-only";
import { sql } from "../db";

// The app owner's dashboard: every business on the app, across accounts. Only /admin uses
// this, behind requireAdmin().

export type PlanStatus = "trial" | "active" | "past_due" | "cancelled" | "free";

export type AdminOverview = {
  total: number;
  today: number;
  week: number;
  month: number;
  prevMonth: number;
  trial: number;
  trialEndingSoon: number;
  trialExpired: number;
  active: number;
  pastDue: number;
  cancelled: number;
  cancelledMonth: number;
  free: number;
  activeWeek: number;
  atRisk: number;
  activated: number;
  /** Monthly recurring revenue by currency (yearly plans count 1/12). */
  mrr: { currency: string; cents: number }[];
  weekly: { week: string; signups: number }[];
  countries: { country: string; n: number }[];
  sources: { source: string; n: number }[];
};

export async function adminOverview(): Promise<AdminOverview> {
  const [[c], mrr, weekly, countries, sources] = await Promise.all([
    sql<Omit<AdminOverview, "mrr" | "weekly" | "countries" | "sources">[]>`
      select count(*)::int as total,
        count(*) filter (where created_at >= date_trunc('day', now()))::int as today,
        count(*) filter (where created_at >= now() - interval '7 days')::int as week,
        count(*) filter (where created_at >= now() - interval '30 days')::int as month,
        count(*) filter (where created_at >= now() - interval '60 days' and created_at < now() - interval '30 days')::int as "prevMonth",
        count(*) filter (where plan_status = 'trial' and trial_ends_at >= now())::int as trial,
        count(*) filter (where plan_status = 'trial' and trial_ends_at between now() and now() + interval '3 days')::int as "trialEndingSoon",
        count(*) filter (where plan_status = 'trial' and trial_ends_at < now())::int as "trialExpired",
        count(*) filter (where plan_status = 'active')::int as active,
        count(*) filter (where plan_status = 'past_due')::int as "pastDue",
        count(*) filter (where plan_status = 'cancelled')::int as cancelled,
        count(*) filter (where plan_status = 'cancelled' and cancelled_at >= now() - interval '30 days')::int as "cancelledMonth",
        count(*) filter (where plan_status = 'free')::int as free,
        count(*) filter (where last_active_at >= now() - interval '7 days')::int as "activeWeek",
        -- Paying or trying, but nobody opened the app in 14 days (or ever, 3 days after signup).
        count(*) filter (where plan_status in ('trial', 'active', 'past_due')
          and coalesce(last_active_at, created_at) < now() - interval '14 days'
          or (plan_status in ('trial', 'active') and last_active_at is null and created_at < now() - interval '3 days'))::int as "atRisk",
        -- Activated: booked at least one visit.
        count(*) filter (where exists (select 1 from appointments a where a.business_id = b.id))::int as activated
      from businesses b`,
    sql<{ currency: string; cents: number }[]>`
      select coalesce(plan_currency, currency) as currency,
             sum(case when plan_interval = 'year' then plan_amount_cents / 12.0 else plan_amount_cents end)::int as cents
      from businesses where plan_status = 'active' and plan_amount_cents is not null
      group by 1 order by 2 desc`,
    sql<{ week: string; signups: number }[]>`
      select to_char(w, 'YYYY-MM-DD') as week,
             (select count(*)::int from businesses b where b.created_at >= w and b.created_at < w + interval '7 days') as signups
      from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '7 days') as w
      order by w`,
    sql<{ country: string; n: number }[]>`select country, count(*)::int as n from businesses group by 1 order by 2 desc limit 12`,
    sql<{ source: string; n: number }[]>`
      select coalesce(nullif(signup_source, ''), 'direto') as source, count(*)::int as n from businesses
      where created_at >= now() - interval '90 days' group by 1 order by 2 desc limit 10`,
  ]);
  return { ...c, mrr, weekly, countries, sources };
}

export type AdminBusiness = {
  id: string;
  name: string;
  owner: string | null;
  email: string | null;
  country: string;
  created_at: Date;
  last_active_at: Date | null;
  plan_status: PlanStatus;
  trial_ends_at: Date | null;
  trial_expired: boolean;
  clients: number;
  visits30: number;
};

export type AdminFilter = "all" | "trial" | "active" | "past_due" | "cancelled" | "free" | "risk" | "new";

export async function adminBusinesses(filter: AdminFilter, q: string): Promise<AdminBusiness[]> {
  const like = q ? `%${q.toLowerCase()}%` : null;
  return sql<AdminBusiness[]>`
    select b.id, b.name, o.name as owner, u.email, b.country, b.created_at, b.last_active_at, b.plan_status, b.trial_ends_at, (b.plan_status = 'trial' and b.trial_ends_at < now()) as trial_expired,
      (select count(*)::int from clients c where c.business_id = b.id) as clients,
      (select count(*)::int from appointments a where a.business_id = b.id and a.start_at >= now() - interval '30 days') as visits30
    from businesses b
    left join lateral (select s.name, s.user_id from staff s where s.business_id = b.id and s.role = 'owner' order by s.created_at limit 1) o on true
    left join users u on u.id = o.user_id
    where (${like}::text is null or lower(b.name) like ${like} or lower(coalesce(u.email, '')) like ${like} or lower(b.booking_slug) like ${like})
      and case ${filter}
        when 'trial' then b.plan_status = 'trial'
        when 'active' then b.plan_status = 'active'
        when 'past_due' then b.plan_status = 'past_due'
        when 'cancelled' then b.plan_status = 'cancelled'
        when 'free' then b.plan_status = 'free'
        when 'new' then b.created_at >= now() - interval '7 days'
        when 'risk' then b.plan_status in ('trial', 'active', 'past_due') and coalesce(b.last_active_at, b.created_at) < now() - interval '14 days'
        else true end
    order by b.created_at desc
    limit 200`;
}

export type AdminBusinessDetail = AdminBusiness & {
  booking_slug: string;
  phone: string | null;
  timezone: string;
  currency: string;
  plan_interval: string | null;
  plan_amount_cents: number | null;
  plan_currency: string | null;
  cancelled_at: Date | null;
  signup_source: string | null;
  staff: number;
  pets: number;
  visits: number;
  online: number;
  services: number;
  collected30: number;
  logo: boolean;
  messages30: number;
};

export async function adminBusiness(id: string): Promise<AdminBusinessDetail | null> {
  const [b] = await sql<AdminBusinessDetail[]>`
    select b.id, b.name, o.name as owner, u.email, b.country, b.created_at, b.last_active_at, b.plan_status, b.trial_ends_at, (b.plan_status = 'trial' and b.trial_ends_at < now()) as trial_expired,
      b.booking_slug, b.phone, b.timezone, b.currency, b.plan_interval, b.plan_amount_cents, b.plan_currency, b.cancelled_at, b.signup_source,
      (select count(*)::int from clients c where c.business_id = b.id) as clients,
      (select count(*)::int from pets p join clients c on c.id = p.client_id where c.business_id = b.id) as pets,
      (select count(*)::int from staff s where s.business_id = b.id and s.active) as staff,
      (select count(*)::int from appointments a where a.business_id = b.id) as visits,
      (select count(*)::int from appointments a where a.business_id = b.id and a.start_at >= now() - interval '30 days') as visits30,
      (select count(*)::int from appointments a where a.business_id = b.id and a.source = 'online') as online,
      (select count(*)::int from services s where s.business_id = b.id and s.active) as services,
      coalesce((select sum(p.amount_cents)::int from payments p join invoices i on i.id = p.invoice_id
                where i.business_id = b.id and p.received_at >= now() - interval '30 days'), 0) as collected30,
      exists (select 1 from business_logos l where l.business_id = b.id) as logo,
      (select count(*)::int from messages m where m.business_id = b.id and m.direction = 'out' and m.created_at >= now() - interval '30 days') as messages30
    from businesses b
    left join lateral (select s.name, s.user_id from staff s where s.business_id = b.id and s.role = 'owner' order by s.created_at limit 1) o on true
    left join users u on u.id = o.user_id
    where b.id = ${id}`;
  return b ?? null;
}
