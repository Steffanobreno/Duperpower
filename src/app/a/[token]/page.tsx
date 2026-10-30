import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { bookingUrl } from "@/lib/messaging";
import { money, phoneLabel } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { LOCALES } from "@/lib/i18n";
import { Button, ButtonLink, Card, Field, Input, Notice } from "@/components/ui";
import { AgreementText } from "@/components/agreement-text";
import { ClientShell, StepCard } from "@/components/client-shell";
import { Calendar, Dog } from "@/components/icons";
import { activeAgreement, currentSignature } from "@/lib/agreement";
import { clientEvent } from "@/lib/client-calendar";
import { cancelByTokenAction, confirmByTokenAction, requestRescheduleByTokenAction } from "./actions";

export const metadata: Metadata = { title: "Your appointment", robots: { index: false } };

export default async function ClientAppointmentPage({ params, searchParams }: PageProps<"/a/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const { lang, t } = await getI18n(sp.lang);
  const locale = LOCALES[lang];
  if (!/^[0-9a-f]{24}$/.test(token)) notFound();
  const [a] = await sql<
    {
      business_id: string;
      client_id: string;
      start_at: Date;
      status: string;
      first_name: string;
      pets: string | null;
      total_cents: number;
      can_cancel: boolean;
      upcoming: boolean;
      business: string;
      phone: string | null;
      timezone: string;
      website_url: string | null;
      cancellation_hours: number;
      reschedule_requested_at: Date | null;
    }[]
  >`
    select a.business_id, a.client_id, a.start_at, a.status, a.reschedule_requested_at, c.first_name, b.name as business, b.phone, b.timezone, b.website_url, b.cancellation_hours,
      (select string_agg(p.name, ' & ' order by p.name) from appointment_pets ap join pets p on p.id = ap.pet_id
        where ap.appointment_id = a.id) as pets,
      coalesce((select sum(s.price_cents) from appointment_pets ap join appointment_services s on s.appointment_pet_id = ap.id
        where ap.appointment_id = a.id), 0)::int as total_cents,
      (a.start_at > now() + make_interval(hours => b.cancellation_hours)) as can_cancel,
      (a.start_at > now()) as upcoming
    from appointments a join clients c on c.id = a.client_id join businesses b on b.id = a.business_id
    where a.public_token = ${token}`;
  if (!a) notFound();
  const tz = a.timezone;
  const phone = phoneLabel(a.phone);
  const open = ["requested", "unconfirmed", "confirmed"].includes(a.status);
  const [agreement, calendar] = await Promise.all([
    a.status === "unconfirmed" ? activeAgreement(a.business_id) : null,
    clientEvent({ token }),
  ]);
  const mustSign = agreement ? !(await currentSignature(agreement, a.client_id)) : false;

  return (
    <ClientShell phone={a.phone} phoneLabel={phone} website={a.website_url} i18n={{ lang, t }}>
      <StepCard className="space-y-4">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{t("Hi {name}!", { name: a.first_name })}</h1>
        <div className="space-y-3 rounded-2xl border border-line p-4">
          <p className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Calendar />
            </span>
            <span>
              <span className="block text-lg font-bold">
                {a.start_at.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric", timeZone: tz })}
              </span>
              <span className="block text-muted">
                {t("Arriving around {time}", { time: a.start_at.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", timeZone: tz }) })}
              </span>
            </span>
          </p>
          {a.pets && (
            <p className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bg">
                <Dog size={22} />
              </span>
              <span>
                <span className="block font-bold">{a.pets}</span>
                <span className="block text-sm text-muted">{t("Estimated {amount}", { amount: money(a.total_cents) })}</span>
              </span>
            </p>
          )}
        </div>

        {a.status === "requested" && (
          <Notice kind="info">{t("We received your request and will text you once it's confirmed.")}</Notice>
        )}
        {a.status === "confirmed" && <Notice kind="success">{t("Confirmed. See you then! 🐾")}</Notice>}
        {a.status === "cancelled" && <Notice kind="warn">{t("This appointment is cancelled.")}</Notice>}
        {a.status === "completed" && <Notice kind="success">{t("All done. Thank you!")}</Notice>}
        {a.status === "en_route" && <Notice kind="success">{t("We're on our way to you! 🚐")}</Notice>}
        {a.status === "in_progress" && <Notice kind="success">{t("Grooming in progress. 🛁")}</Notice>}
        {a.status === "declined" && <Notice kind="warn">{t("Sorry, we couldn't take this request. Please pick another time.")}</Notice>}
        {a.status === "no_show" && <Notice kind="warn">{t("We missed you at this visit. Text us to book a new time.")}</Notice>}
        {sp.needSign && a.status === "unconfirmed" && (
          <Notice kind="error">{t("Please tick the box and type your full name to sign, then confirm.")}</Notice>
        )}

        {calendar && (
          <div className="grid grid-cols-2 gap-2">
            <a href={calendar.apple} className="rounded-full border-2 border-brand py-2.5 text-center text-sm font-bold text-brand">
              {t("📅 Add to iPhone")}
            </a>
            <a href={calendar.google} target="_blank" rel="noreferrer" className="rounded-full border-2 border-brand py-2.5 text-center text-sm font-bold text-brand">
              {t("📅 Google Calendar")}
            </a>
          </div>
        )}

        {a.status === "unconfirmed" && (
          <form action={confirmByTokenAction.bind(null, token)} className="space-y-3">
            {mustSign && agreement && (
              <Card className="space-y-3">
                <p className="text-sm font-medium">{t("Please read and sign our service agreement (once a year).")}</p>
                <div
                  className="max-h-80 overflow-y-auto rounded-xl border border-line bg-bg p-3"
                  tabIndex={0}
                  aria-label={t("Service agreement")}
                >
                  <AgreementText title={agreement.title} body={agreement.body} />
                </div>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" name="agree" required className="mt-1 h-4 w-4" />
                  <span>{t("I have read and agree to the service agreement.")}</span>
                </label>
                <Field label={t("Type your full name to sign")}>
                  <Input name="signature" required minLength={3} autoComplete="name" />
                </Field>
              </Card>
            )}
            <Button type="submit" className="w-full rounded-full py-4 text-lg">
              {mustSign ? t("Sign and confirm") : t("Confirm my appointment")}
            </Button>
          </form>
        )}
        {open && a.upcoming && (a.reschedule_requested_at ? (
          <Notice kind="info">{t("We got your request for a different time and will text you a new one.")}</Notice>
        ) : (
          <details className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <summary className="cursor-pointer text-center font-semibold text-brand">{t("I need a different time")}</summary>
            <form action={requestRescheduleByTokenAction.bind(null, token)} className="mt-3 space-y-2">
              <label className="block text-sm">
                <span className="font-medium">{t("Which days and times work for you?")}</span>
                <textarea name="note" rows={3} placeholder={t("e.g. Any morning next week, or Saturday after 1pm")}
                  className="mt-1 block w-full rounded-xl border border-line px-3 py-2" />
              </label>
              <Button type="submit" className="w-full">{t("Ask for a new time")}</Button>
            </form>
          </details>
        ))}
        {open && a.upcoming && (
          <details className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <summary className="cursor-pointer text-center font-semibold text-danger">{t("I need to cancel")}</summary>
            <form action={cancelByTokenAction.bind(null, token)} className="mt-3 space-y-2">
              {a.can_cancel ? (
                <p className="text-sm text-muted">{t("Cancelling now is free. Your time will be given to someone else.")}</p>
              ) : (
                <Notice kind="warn">
                  {t("Your visit is less than {hours} hours away, so a late cancellation fee of 50% of the service price applies (about {amount}).",
                    { hours: a.cancellation_hours, amount: money(Math.round(a.total_cents / 2)) })}
                </Notice>
              )}
              <Button type="submit" kind="danger" className="w-full">
                {t("Yes, cancel it")}
              </Button>
            </form>
          </details>
        )}
        {(a.status === "cancelled" || a.status === "declined") && (
          <ButtonLink href={bookingUrl(a)} className="w-full rounded-full py-4 text-lg">
            {t("Book a new time")}
          </ButtonLink>
        )}
        {a.phone && (
          <p className="text-center text-sm text-muted">
            {t("Questions? Text {phone}", { phone: "" })}
            <a className="underline" href={`sms:${a.phone}`}>
              {phone}
            </a>
          </p>
        )}
      </StepCard>
    </ClientShell>
  );
}
