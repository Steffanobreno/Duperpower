import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getAppointment } from "@/lib/data/appointments";
import { getInvoiceForAppointment } from "@/lib/data/invoices";
import { fullName } from "@/lib/data/clients";
import { directionsUrl } from "@/lib/directions";
import { addDaysYmd, hm, longDayLabel, minutesLabel, money, phoneLabel, sizeLabel, timeLabel, ymd } from "@/lib/format";
import { Button, ButtonLink, Card, Notice, Page, PageHeader, StatusBadge, Textarea } from "@/components/ui";
import { setStatusAction, rescheduleAction, startCheckoutAction, updateNotesAction } from "../actions";
import { RescheduleForm } from "../reschedule-form";

export const metadata: Metadata = { title: "Appointment" };

// The main next step for each status, shown as the big button.
const PRIMARY: Record<string, { to: string; label: string } | undefined> = {
  requested: { to: "unconfirmed", label: "Accept request" },
  unconfirmed: { to: "confirmed", label: "Mark as confirmed" },
  confirmed: { to: "en_route", label: "I'm on the way" },
  en_route: { to: "in_progress", label: "Arrived, start grooming" },
  in_progress: { to: "completed", label: "Finish and check out" },
};

export default async function AppointmentPage({ params, searchParams }: PageProps<"/appointments/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const appt = await getAppointment(staff, id);
  if (!appt) notFound();
  const checkout = await getInvoiceForAppointment(staff, id);
  const tz = staff.timezone;
  const c = appt.client;
  const minutes = Math.round((appt.end_at.getTime() - appt.start_at.getTime()) / 60000);
  const total = appt.pets.flatMap((p) => p.services).reduce((s, x) => s + x.price_cents, 0);
  const primary = PRIMARY[appt.status];
  const closed = ["cancelled", "no_show", "declined"].includes(appt.status);
  // Next visit: the shortest grooming frequency among the pets, or 6 weeks.
  const frequencies = appt.pets.map((p) => p.rebook_every_days).filter((d): d is number => d != null);
  const rebookDays = frequencies.length ? Math.min(...frequencies) : 42;
  const nextDate = addDaysYmd(ymd(appt.start_at, tz), rebookDays);

  const statusButton = (to: string, label: string, kind: "primary" | "secondary" | "danger" = "secondary") => (
    <form action={setStatusAction.bind(null, id, to)}>
      <Button type="submit" kind={kind} className="w-full">
        {label}
      </Button>
    </form>
  );

  return (
    <>
      <PageHeader title={fullName(c)} back={`/today?date=${ymd(appt.start_at, tz)}`} />
      <Page>
        {sp.booked === "1" && <Notice kind="success">Appointment booked.</Notice>}
        {sp.conflict === "1" && <Notice kind="error">Another appointment already uses that time.</Notice>}

        <Card className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold">{longDayLabel(appt.start_at, tz)}</p>
              <p className="text-muted">
                {timeLabel(appt.start_at, tz)} – {timeLabel(appt.end_at, tz)} · {minutesLabel(minutes)}
              </p>
            </div>
            <StatusBadge status={checkout?.invoice.status === "closed" ? "paid" : appt.status} />
          </div>
          {primary && statusButton(primary.to, primary.label, "primary")}
          {checkout && appt.status === "completed" && (
            <ButtonLink href={`/appointments/${id}/checkout`} className="w-full">
              {checkout.invoice.status === "closed" ? "See receipt" : "Continue checkout"}
            </ButtonLink>
          )}
          {!checkout && appt.status === "completed" && (
            <form action={startCheckoutAction.bind(null, id)}>
              <Button type="submit" className="w-full">Check out</Button>
            </form>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <ButtonLink kind="secondary" href={`tel:${c.phone}`}>Call</ButtonLink>
            <ButtonLink kind="secondary" href={`sms:${c.phone}`}>Text</ButtonLink>
            {appt.address_line && (
              <ButtonLink
                kind="secondary"
                href={directionsUrl({ address: appt.address_line, lat: appt.lat, lng: appt.lng })}
                target="_blank"
              >
                Directions
              </ButtonLink>
            )}
            <ButtonLink kind="ghost" href={`/clients/${c.id}`}>Client profile</ButtonLink>
          </div>
          <p className="text-sm">
            <span className="text-muted">Phone </span>
            {phoneLabel(c.phone)}
          </p>
          <p className="text-sm">
            <span className="text-muted">Address </span>
            {appt.address_line ?? "No address on file"}
          </p>
          {c.access_notes && <Notice kind="info">{c.access_notes}</Notice>}
        </Card>

        <section className="space-y-2">
          <h2 className="font-bold">Pets and services</h2>
          {appt.pets.map((p) => (
            <Card key={p.appointment_pet_id} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{p.name}</span>
                <span className="text-sm text-muted">{[p.breed, sizeLabel(p.size_class)].filter(Boolean).join(" · ")}</span>
              </div>
              {p.behavior && <Notice kind="warn">{p.behavior}</Notice>}
              {p.notes && <p className="whitespace-pre-line text-sm text-muted">{p.notes}</p>}
              <ul className="text-sm">
                {p.services.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3 py-0.5">
                    <span>{s.name}</span>
                    <span>{money(s.price_cents)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          <div className="flex justify-between px-1 font-semibold">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold">Visit notes</h2>
          <form action={updateNotesAction.bind(null, id)} className="space-y-2">
            <label className="sr-only" htmlFor="notes">Visit notes</label>
            <Textarea id="notes" name="notes" defaultValue={appt.notes ?? ""} />
            <Button type="submit" kind="secondary">Save notes</Button>
          </form>
        </section>

        {!closed && appt.status !== "completed" && (
          <section className="space-y-2">
            <h2 className="font-bold">Reschedule</h2>
            <Card>
              <RescheduleForm
                action={rescheduleAction.bind(null, id)}
                date={ymd(appt.start_at, tz)}
                time={hm(appt.start_at, tz)}
              />
            </Card>
          </section>
        )}

        <section className="grid gap-2 sm:grid-cols-2">
          <ButtonLink
            kind="secondary"
            href={`/appointments/new?client=${c.id}&date=${nextDate}&time=${hm(appt.start_at, tz)}`}
          >
            Book again in {rebookDays} days
          </ButtonLink>
          {!closed && appt.status !== "completed" && (
            <>
              {statusButton("cancelled", "Cancel appointment", "danger")}
              {statusButton("no_show", "Mark as no-show", "danger")}
            </>
          )}
          {closed && statusButton("unconfirmed", "Restore appointment")}
        </section>
        <p className="text-center text-xs text-muted">
          <Link href={`/calendar?date=${ymd(appt.start_at, tz)}`} className="underline">See this day in the calendar</Link>
        </p>
      </Page>
    </>
  );
}
