import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { dayLabel, money, phoneLabel, timeLabel } from "@/lib/format";
import { Button, Card, Empty, Page, PageHeader } from "@/components/ui";
import { setStatusAction } from "../appointments/actions";
import { STEP_LABEL } from "@/lib/messaging";
import { dismissDraftAction } from "./actions";

export const metadata: Metadata = { title: "Requests" };

export default async function RequestsPage() {
  const staff = await requireStaff();
  const rows = await sql<
    { id: string; start_at: Date; client: string; phone: string; address_line: string | null; notes: string | null;
      pets: string | null; total_cents: number; created_at: Date; new_client: boolean }[]
  >`
    select a.id, a.start_at, a.address_line, a.notes, a.created_at, trim(c.first_name || ' ' || c.last_name) as client, c.phone,
      (c.source = 'online' and c.created_at > a.created_at - interval '1 minute') as new_client,
      (select string_agg(p.name || ' (' || coalesce((select string_agg(s.name, ', ') from appointment_services s
                                                      where s.appointment_pet_id = ap.id), '') || ')', ' · ')
         from appointment_pets ap join pets p on p.id = ap.pet_id where ap.appointment_id = a.id) as pets,
      coalesce((select sum(s.price_cents) from appointment_pets ap join appointment_services s on s.appointment_pet_id = ap.id
        where ap.appointment_id = a.id), 0)::int as total_cents
    from appointments a join clients c on c.id = a.client_id
    where a.business_id = ${staff.businessId} and a.status = 'requested' and a.start_at > now() -- past ones expired
    order by a.start_at`;
  const reschedules = await sql<{ id: string; start_at: Date; client: string; phone: string; reschedule_note: string | null }[]>`
    select a.id, a.start_at, a.reschedule_note, trim(c.first_name || ' ' || c.last_name) as client, c.phone
    from appointments a join clients c on c.id = a.client_id
    where a.business_id = ${staff.businessId} and a.reschedule_requested_at is not null
      and a.status in ('requested', 'unconfirmed', 'confirmed') and a.start_at > now()
    order by a.reschedule_requested_at`;
  // People who started booking online in the last two weeks and stopped.
  const drafts = await sql<{ id: string; phone: string; first_name: string | null; last_name: string | null; email: string | null;
                            pets: string | null; step: string; updated_at: Date; reminded_at: Date | null; client_id: string | null }[]>`
    select id, phone, first_name, last_name, email, pets, step, updated_at, reminded_at, client_id from booking_drafts d
    where business_id = ${staff.businessId} and completed_at is null and dismissed_at is null
      and updated_at > now() - interval '14 days' and updated_at < now() - interval '20 minutes'
      and not exists (select 1 from appointments a join clients c on c.id = a.client_id
                      where c.business_id = d.business_id and c.phone = d.phone and a.created_at > d.created_at)
    order by updated_at desc limit 30`;
  const tz = staff.timezone;
  return (
    <>
      <PageHeader title="Booking requests" back="/today" />
      <Page>
        {reschedules.length > 0 && (
          <section className="space-y-2">
            <h2 className="section-label">Asked for a different time</h2>
            {reschedules.map((r) => (
              <Link key={r.id} href={`/appointments/${r.id}#reschedule`} className="card block space-y-1 border-warn px-4 py-3">
                <p className="font-semibold">{r.client} · <span className="font-normal">{dayLabel(r.start_at, tz)} {timeLabel(r.start_at, tz)}</span></p>
                {r.reschedule_note && <p className="text-sm">&quot;{r.reschedule_note}&quot;</p>}
                <p className="text-sm text-muted">{phoneLabel(r.phone)} · tap to move it</p>
              </Link>
            ))}
          </section>
        )}
        {rows.length > 0 && reschedules.length > 0 && <h2 className="section-label">New booking requests</h2>}
        {rows.length === 0 ? (
          <Empty title="No requests waiting">New requests from your booking page show up here.</Empty>
        ) : (
          rows.map((r) => (
            <Card key={r.id} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={`/appointments/${r.id}`} className="font-semibold underline-offset-2 hover:underline">
                  {r.client}
                </Link>
                {r.new_client && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">New client</span>}
              </div>
              <p className="font-medium">
                {dayLabel(r.start_at, tz)} · {timeLabel(r.start_at, tz)}
              </p>
              <p className="text-sm text-muted">{r.pets}</p>
              <p className="text-sm">{r.address_line}</p>
              <p className="text-sm">
                {phoneLabel(r.phone)} · {money(r.total_cents)}
              </p>
              {r.notes && <p className="whitespace-pre-line rounded-xl bg-bg p-2 text-sm">{r.notes}</p>}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <form action={setStatusAction.bind(null, r.id, "declined")}>
                  <Button type="submit" kind="danger" className="w-full">Decline</Button>
                </form>
                <form action={setStatusAction.bind(null, r.id, "unconfirmed")}>
                  <Button type="submit" className="w-full">Accept</Button>
                </form>
              </div>
            </Card>
          ))
        )}

        {drafts.length > 0 && (
          <section className="space-y-2 pt-2">
            <h2 className="section-label">Didn&apos;t finish booking online</h2>
            <p className="px-1 text-sm text-muted">
              They started on your booking page and stopped. A quick call or text often gets the booking.
            </p>
            {drafts.map((d) => (
              <Card key={d.id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  {d.client_id ? (
                    <Link href={`/clients/${d.client_id}`} className="font-semibold underline-offset-2 hover:underline">
                      {[d.first_name, d.last_name].filter(Boolean).join(" ") || "Client"}
                    </Link>
                  ) : (
                    <span className="font-semibold">{[d.first_name, d.last_name].filter(Boolean).join(" ") || "Unknown name"}</span>
                  )}
                  <span className="shrink-0 text-xs text-muted">{dayLabel(d.updated_at, tz)} {timeLabel(d.updated_at, tz)}</span>
                </div>
                <p className="text-sm text-muted">
                  Stopped {STEP_LABEL[d.step] ?? d.step}{d.pets ? ` · ${d.pets}` : ""}
                </p>
                <p className="text-sm">{phoneLabel(d.phone)}{d.email ? ` · ${d.email}` : ""}</p>
                {d.reminded_at && <p className="text-xs font-semibold text-success">Sent them a link to finish on {dayLabel(d.reminded_at, tz)}</p>}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <a href={`sms:${d.phone}`} className="rounded-xl border border-line py-2 text-center text-sm font-semibold text-brand">Text</a>
                  <a href={`tel:${d.phone}`} className="rounded-xl border border-line py-2 text-center text-sm font-semibold text-brand">Call</a>
                  <form action={dismissDraftAction.bind(null, d.id)}>
                    <button type="submit" className="w-full rounded-xl border border-line py-2 text-sm font-semibold text-muted">Clear</button>
                  </form>
                </div>
              </Card>
            ))}
          </section>
        )}
      </Page>
    </>
  );
}
