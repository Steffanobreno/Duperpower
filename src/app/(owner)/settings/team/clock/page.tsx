import { DateField } from "@/components/date-field";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { addDaysYmd, hm, isYmd, todayYmd, ymd, dayRangeUtc } from "@/lib/format";
import { Button, Card, Empty, Page, PageHeader } from "@/components/ui";
import { setClockEnabledAction } from "../actions";
import { ClockRow } from "./clock-row";

export const metadata: Metadata = { title: "Clock in and out" };

export default async function ClockPage({ searchParams }: PageProps<"/settings/team/clock">) {
  const staff = await requirePermission("settings");
  const sp = await searchParams;
  const tz = staff.timezone;
  const to = isYmd(sp.to) ? sp.to : todayYmd(tz);
  const from = isYmd(sp.from) ? sp.from : addDaysYmd(to, -13);
  const [[b], entries] = await Promise.all([
    sql<{ clock_enabled: boolean }[]>`select clock_enabled from businesses where id = ${staff.businessId}`,
    sql<{ id: string; name: string; in_at: Date; out_at: Date | null }[]>`
      select e.id, s.name, e.in_at, e.out_at from clock_entries e join staff s on s.id = e.staff_id
      where s.business_id = ${staff.businessId} and e.in_at >= ${dayRangeUtc(from, tz).start} and e.in_at < ${dayRangeUtc(to, tz).end}
      order by e.in_at desc`,
  ]);
  const hours = new Map<string, number>();
  for (const e of entries) if (e.out_at) hours.set(e.name, (hours.get(e.name) ?? 0) + (e.out_at.getTime() - e.in_at.getTime()) / 3600_000);
  return (
    <>
      <PageHeader title="Clock in and out" back="/settings/team" />
      <Page>
        <Card className="space-y-3">
          <p className="text-sm text-muted">
            {b.clock_enabled
              ? "On. Everyone has a Clock in / Clock out button on Today. Hours count in payroll."
              : "Off. Turn it on to track hours (for hourly pay)."}
          </p>
          <form action={setClockEnabledAction.bind(null, !b.clock_enabled)}>
            <Button type="submit" kind={b.clock_enabled ? "secondary" : "primary"} className="w-full">
              {b.clock_enabled ? "Turn clock in/out off" : "Turn clock in/out on"}
            </Button>
          </form>
        </Card>
        <form className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <label className="text-sm">From<DateField name="from" defaultValue={from} className="mt-1" /></label>
          <label className="text-sm">To<DateField name="to" defaultValue={to} className="mt-1" /></label>
          <Button type="submit" kind="secondary">Show</Button>
        </form>
        {hours.size > 0 && (
          <p className="px-1 text-sm">
            {[...hours].map(([name, h]) => <span key={name} className="mr-3 inline-block"><strong>{name}</strong> {h.toFixed(1)} h</span>)}
          </p>
        )}
        {entries.length ? (
          <ul className="card divide-y divide-line overflow-hidden">
            {entries.map((e) => (
              <ClockRow key={e.id} id={e.id} name={e.name} date={ymd(e.in_at, tz)} inT={hm(e.in_at, tz)}
                outT={e.out_at ? hm(e.out_at, tz) : ""} />
            ))}
          </ul>
        ) : (
          <Empty title="No hours in these days" />
        )}
      </Page>
    </>
  );
}
