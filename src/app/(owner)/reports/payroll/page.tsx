import { DateField } from "@/components/date-field";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { dayRangeUtc, isYmd, money, todayYmd } from "@/lib/format";
import { Button, Card, Empty, Page, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Payroll" };

type Row = {
  id: string; name: string; commission_pct: number; tips_pct: number; hourly_cents: number;
  visits: number; services_cents: number; tips_cents: number; minutes: number;
};

// What each team member earned in a period: commission on the services of their finished
// visits, their share of the tips paid for those visits, and hours clocked × hourly pay.
export default async function PayrollPage({ searchParams }: PageProps<"/reports/payroll">) {
  const staff = await requirePermission("reports");
  const sp = await searchParams;
  const tz = staff.timezone;
  const today = todayYmd(tz);
  const from = isYmd(sp.from) ? sp.from : `${today.slice(0, 7)}-01`;
  const to = isYmd(sp.to) ? sp.to : today;
  const start = dayRangeUtc(from, tz).start;
  const end = dayRangeUtc(to, tz).end;
  const rows = await sql<Row[]>`
    select s.id, s.name, s.commission_pct::float8 as commission_pct, s.tips_pct::float8 as tips_pct, s.hourly_cents,
      (select count(*) from appointments a where a.staff_id = s.id and a.status = 'completed'
         and a.start_at >= ${start} and a.start_at < ${end})::int as visits,
      coalesce((select sum(x.price_cents) from appointments a join appointment_pets ap on ap.appointment_id = a.id
                join appointment_services x on x.appointment_pet_id = ap.id
                where a.staff_id = s.id and a.status = 'completed' and a.start_at >= ${start} and a.start_at < ${end}), 0)::int as services_cents,
      coalesce((select sum(p.tip_cents) from payments p join invoices i on i.id = p.invoice_id
                join appointments a on a.id = i.appointment_id
                where a.staff_id = s.id and p.received_at >= ${start} and p.received_at < ${end}), 0)::int as tips_cents,
      coalesce((select sum(extract(epoch from (e.out_at - e.in_at)) / 60) from clock_entries e
                where e.staff_id = s.id and e.out_at is not null and e.in_at >= ${start} and e.in_at < ${end}), 0)::float8 as minutes
    from staff s where s.business_id = ${staff.businessId}
    order by (s.role = 'owner') desc, s.created_at`;
  const pay = (r: Row) => {
    const commission = Math.round((r.services_cents * r.commission_pct) / 100);
    const tips = Math.round((r.tips_cents * r.tips_pct) / 100);
    const hourly = Math.round((r.minutes / 60) * r.hourly_cents);
    return { commission, tips, hourly, total: commission + tips + hourly };
  };
  const shown = rows.filter((r) => r.visits || r.tips_cents || r.minutes);
  return (
    <>
      <PageHeader title="Payroll" back="/reports" />
      <Page>
        <form className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <label className="text-sm">From<DateField name="from" defaultValue={from} className="mt-1" /></label>
          <label className="text-sm">To<DateField name="to" defaultValue={to} className="mt-1" /></label>
          <Button type="submit" kind="secondary">Show</Button>
        </form>
        {shown.length ? shown.map((r) => {
          const p = pay(r);
          return (
            <Card key={r.id} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-bold">{r.name}</h2>
                <span className="text-xl font-extrabold">{money(p.total)}</span>
              </div>
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted">Commission · {r.commission_pct}% of {money(r.services_cents)} ({r.visits} visit{r.visits === 1 ? "" : "s"})</dt>
                <dd className="text-right">{money(p.commission)}</dd>
                <dt className="text-muted">Tips · {r.tips_pct}% of {money(r.tips_cents)}</dt>
                <dd className="text-right">{money(p.tips)}</dd>
                <dt className="text-muted">Hours · {(r.minutes / 60).toFixed(1)} h × {money(r.hourly_cents)}</dt>
                <dd className="text-right">{money(p.hourly)}</dd>
              </dl>
            </Card>
          );
        }) : <Empty title="Nothing to pay in these days" />}
        <p className="px-1 text-xs text-muted">Set each person&apos;s commission, tips share and hourly pay in Settings → Team.</p>
      </Page>
    </>
  );
}
