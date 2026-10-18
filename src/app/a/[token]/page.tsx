import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { bookingUrl } from "@/lib/messaging";
import { longDayLabel, money, phoneLabel, timeLabel } from "@/lib/format";
import { Button, ButtonLink, Card, Notice } from "@/components/ui";
import { cancelByTokenAction, confirmByTokenAction } from "./actions";

export const metadata: Metadata = { title: "Your appointment", robots: { index: false } };

export default async function ClientAppointmentPage({ params }: PageProps<"/a/[token]">) {
  const { token } = await params;
  if (!/^[0-9a-f]{24}$/.test(token)) notFound();
  const [a] = await sql<
    { start_at: Date; status: string; first_name: string; pets: string | null; total_cents: number; can_cancel: boolean;
      business: string; phone: string | null; timezone: string; website_url: string | null; cancellation_hours: number }[]
  >`
    select a.start_at, a.status, c.first_name, b.name as business, b.phone, b.timezone, b.website_url, b.cancellation_hours,
      (select string_agg(p.name, ' & ' order by p.name) from appointment_pets ap join pets p on p.id = ap.pet_id
        where ap.appointment_id = a.id) as pets,
      coalesce((select sum(s.price_cents) from appointment_pets ap join appointment_services s on s.appointment_pet_id = ap.id
        where ap.appointment_id = a.id), 0)::int as total_cents,
      (a.start_at > now() + make_interval(hours => b.cancellation_hours)) as can_cancel
    from appointments a join clients c on c.id = a.client_id join businesses b on b.id = a.business_id
    where a.public_token = ${token}`;
  if (!a) notFound();
  const tz = a.timezone;
  const phone = phoneLabel(a.phone);
  const open = ["requested", "unconfirmed", "confirmed"].includes(a.status);

  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Hi {a.first_name}!</h1>
      <Card className="space-y-1">
        <p className="text-sm text-muted">{a.business}</p>
        <p className="text-lg font-bold">{longDayLabel(a.start_at, tz)}</p>
        <p>Arriving around {timeLabel(a.start_at, tz)}</p>
        {a.pets && <p className="text-muted">{a.pets}</p>}
        <p className="text-sm text-muted">Estimated {money(a.total_cents)}</p>
      </Card>

      {a.status === "requested" && <Notice kind="info">We received your request and will text you once it&apos;s confirmed.</Notice>}
      {a.status === "confirmed" && <Notice kind="success">Confirmed. See you then! 🐾</Notice>}
      {a.status === "cancelled" && <Notice kind="warn">This appointment is cancelled.</Notice>}
      {a.status === "completed" && <Notice kind="success">All done. Thank you!</Notice>}

      {a.status === "unconfirmed" && (
        <form action={confirmByTokenAction.bind(null, token)}>
          <Button type="submit" className="w-full">Confirm my appointment</Button>
        </form>
      )}
      {open &&
        (a.can_cancel ? (
          <details className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <summary className="cursor-pointer text-center font-semibold text-danger">I need to cancel</summary>
            <form action={cancelByTokenAction.bind(null, token)} className="mt-3 space-y-2">
              <p className="text-sm text-muted">Are you sure? Your time will be given to someone else.</p>
              <Button type="submit" kind="danger" className="w-full">Yes, cancel it</Button>
            </form>
          </details>
        ) : (
          <p className="text-center text-sm text-muted">
            Need to change it? It&apos;s less than {a.cancellation_hours} hours away, so please text us at {phone}.
          </p>
        ))}
      {a.status === "cancelled" && (
        <ButtonLink href={bookingUrl(a)} className="w-full">Book a new time</ButtonLink>
      )}
      <p className="text-center text-sm text-muted">
        Questions? Text <a className="underline" href={`sms:${a.phone}`}>{phone}</a>
      </p>
    </main>
  );
}
