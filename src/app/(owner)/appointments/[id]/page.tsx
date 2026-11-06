import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Toast } from "@/components/toast";
import { clientTagsFor, petCodesFor } from "@/lib/data/options";
import { PetCodeChips, TagChips } from "@/components/chips";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getAppointment } from "@/lib/data/appointments";
import { getInvoiceForAppointment } from "@/lib/data/invoices";
import { smsTextFor } from "@/lib/messaging";
import { sql } from "@/lib/db";
import { fullName } from "@/lib/data/clients";
import { addDaysYmd, dayLabel, hm, isYmd, longDayLabel, minutesLabel, money, phoneLabel, sizeLabel, timeLabel, ymd, zonedToUtc } from "@/lib/format";
import { Button, Card, Notice, Page, PageHeader, statusLabel, Textarea } from "@/components/ui";
import { Calendar, Card as Card2, Chat, Check, ChevronDown, ChevronRight, Clock, Close, Hourglass, Pencil, Phone, Pin, Plus, Van } from "@/components/icons";
import { NEXT_STATUS } from "@/lib/appointment-status";
import { ruleLabel, type RepeatRule } from "@/lib/repeat";
import { assignGroomerAction, setStatusAction, rescheduleAction, startCheckoutAction, updateNotesAction } from "../actions";
import { listGroomers } from "@/lib/data/staff";
import { alertText, vaccineAlerts } from "@/lib/data/vaccines";
import { RescheduleForm } from "../reschedule-form";
import { ReschedulePlanner } from "./reschedule-planner";
import { OnMyWayButton } from "@/components/on-my-way";
import { GroomForm } from "./groom-form";
import { visitGrooms } from "@/lib/data/grooms";
import { PetPhoto } from "@/components/pet-photo";
import { ConfirmButton } from "@/components/confirm-button";
import { AddressLink, PhoneLink } from "@/components/contact-sheet";

export const metadata: Metadata = { title: "Appointment" };

// The main next step for each status, shown as the big button.
const PRIMARY: Record<string, { to: string; label: string } | undefined> = {
  requested: { to: "unconfirmed", label: "Accept request" },
  // Accepted is booked: the client confirms from the reminder text, nothing to do here.
  unconfirmed: { to: "en_route", label: "I'm on the way" },
  confirmed: { to: "en_route", label: "I'm on the way" },
  en_route: { to: "in_progress", label: "Check in" },
  in_progress: { to: "completed", label: "Finish order" },
};

const TRIGGER_LABEL: Record<string, string> = {
  booked: "Booking confirmation",
  request_received: "Request received",
  request_declined: "Request declined",
  reminder: "Reminder",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  rebook: "Time to rebook",
  review_request: "Review request",
};
const MESSAGE_STATUS: Record<string, string> = {
  queued: "Waiting for your iPhone",
  handed_off: "Sent from iPhone",
  sent: "Sent",
  failed: "Failed",
  skipped: "Not sent (too late)",
};

export default async function AppointmentPage({ params, searchParams }: PageProps<"/appointments/[id]">) {
  const { t } = await getOwnerI18n();
  const staff = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const appt = await getAppointment(staff, id);
  if (!appt) notFound();
  const [checkout, onMyWay, messages, [series], groomers, vaccines, codes, tags, cuts] = await Promise.all([
    getInvoiceForAppointment(staff, id),
    smsTextFor(id, "on_my_way"),
    sql<{ id: string; channel: string; status: string; template_trigger: string | null; created_at: Date }[]>`
      select id, channel, status, template_trigger, created_at from messages
      where appointment_id = ${id} and business_id = ${staff.businessId} order by created_at desc limit 20`,
    sql<{ freq: RepeatRule["freq"]; interval_n: number; occurrences: number | null; ends_on: string | null; first: Date; upcoming: number }[]>`
      select s.freq, s.interval_n, s.occurrences, to_char(s.ends_on, 'YYYY-MM-DD') as ends_on,
        (select min(x.start_at) from appointments x where x.series_id = s.id) as first,
        (select count(*)::int from appointments x where x.series_id = s.id and x.start_at > ${appt.start_at}
           and x.status in ('unconfirmed', 'confirmed')) as upcoming
      from appointment_series s where s.id = ${appt.series_id ?? null}::uuid`,
    listGroomers(staff),
    vaccineAlerts(staff, appt.pets.map((p) => p.pet_id), ymd(appt.start_at, staff.timezone)),
    petCodesFor(appt.pets.map((p) => p.pet_id)),
    clientTagsFor([appt.client.id]),
    visitGrooms(staff, id, appt.pets.map((p) => p.pet_id)),
  ]);
  const groomer = groomers.find((g) => g.id === appt.staff_id);
  const otherGroomers = groomers.filter((g) => g.active && g.id !== appt.staff_id);
  const tz = staff.timezone;
  const c = appt.client;
  const minutes = Math.round((appt.end_at.getTime() - appt.start_at.getTime()) / 60000);
  const total = appt.pets.flatMap((p) => p.services).reduce((s, x) => s + x.price_cents, 0);
  const primary = PRIMARY[appt.status];
  const paid = checkout?.invoice.status === "closed";
  const closed = ["cancelled", "no_show", "declined"].includes(appt.status);
  // Next visit: the shortest grooming frequency among the pets, or 6 weeks.
  const frequencies = appt.pets.map((p) => p.rebook_every_days).filter((d): d is number => d != null);
  const rebookDays = frequencies.length ? Math.min(...frequencies) : 42;
  const nextDate = addDaysYmd(ymd(appt.start_at, tz), rebookDays);

  const rebookWeeks = Math.round(rebookDays / 7);
  const canChange = !closed && appt.status !== "completed";
  // Services and prices can change until the visit is cancelled, even after checkout (the bill follows).
  const canEditServices = !closed;
  // Any visit that isn't cancelled can move; a finished one just gets its time corrected (no text to the client).
  const canMove = !closed;
  const finishedMove = ["en_route", "in_progress", "completed"].includes(appt.status);
  const day = ymd(appt.start_at, tz);
  // Moving and booking again open the calendar on that day, to see the schedule and tap a free time.
  const moveHref = `/calendar?view=day&date=${day}&pick=move&appt=${id}`;
  // The planner inside the page (Reschedule section): ?rs=<day>, ?rsm=1 with the month open.
  const planDay = isYmd(sp.rs) ? sp.rs : day;
  const planHref = `/appointments/${id}?rs=${day}#reschedule`;
  const bookAgainHref = `/calendar?view=day&date=${nextDate}&pick=book&client=${c.id}`;
  const picked = sp.move === "1" && isYmd(sp.date) && typeof sp.time === "string" && /^\d{2}:\d{2}$/.test(sp.time)
    ? { date: sp.date, time: sp.time } : null;
  const pillar = "flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-xs font-semibold text-brand hover:bg-brand-soft";

  return (
    <>
      <PageHeader title={t("Appointment")} back={`/today?date=${ymd(appt.start_at, tz)}`} />
      <Page>
        {sp.booked === "1" && <Toast>{t("Appointment booked.")}</Toast>}
        {picked && canMove && (
          <section className="card space-y-3 border-2 border-brand p-4" aria-label={t("Move this visit")}>
            <p className="font-bold">
              {t("Move to {longDayLabel} at {timeLabel}?", { longDayLabel: longDayLabel(zonedToUtc(picked.date, picked.time, tz), tz), timeLabel: timeLabel(zonedToUtc(picked.date, picked.time, tz), tz) })}
            </p>
            <RescheduleForm action={rescheduleAction.bind(null, id)} date={picked.date} time={picked.time} notify={!finishedMove} primary />
            <Link href={`/appointments/${id}?rs=${picked.date}#reschedule`} className="block text-center text-sm font-semibold text-brand">{t("Pick another time")}</Link>
          </section>
        )}
        {sp.conflict === "1" && <Notice kind="error">{t("Another appointment already uses that time.")}</Notice>}
        {appt.reschedule_requested_at && (
          <div className="rounded-2xl border border-warn bg-warn-soft px-4 py-3 text-warn">
            <p className="font-bold">{t("The client asked for a different time")}</p>
            {appt.reschedule_note && <p className="mt-1 text-ink">&quot;{appt.reschedule_note}&quot;</p>}
            <p className="mt-1 text-sm">{t("Move it below in Reschedule (this note clears when you do), or text them.")}</p>
          </div>
        )}

        <details className="card group">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
            <span aria-hidden className={`h-3 w-3 rounded-full ${STATUS_DOT[appt.status] ?? "bg-muted"}`} />
            <span className="flex-1 font-bold uppercase tracking-wide">{STATUS_NAME[appt.status] ?? statusLabel(appt.status)}</span>
            {paid ? <span className="text-sm font-bold text-success">PAID</span>
              : appt.status === "completed" ? <span className="text-sm font-bold text-danger">UNPAID</span> : null}
            {(NEXT_STATUS[appt.status]?.length ?? 0) > 0 && <ChevronDown size={18} className="text-muted transition group-open:rotate-180" />}
          </summary>
          <div className="grid gap-2 border-t border-line p-3">
            {(NEXT_STATUS[appt.status] ?? []).map((to) => (
              <form key={to} action={setStatusAction.bind(null, id, to)}>
                {TAKES_OFF[to] ? (
                  <ConfirmButton question={TAKES_OFF[to]} className="w-full rounded-full bg-danger-soft py-3 font-semibold text-danger">
                    {STATUS_NAME[to] ?? statusLabel(to)}
                  </ConfirmButton>
                ) : (
                  <button type="submit" className="w-full rounded-full bg-bg py-3 font-semibold">
                    {MENU_NAME[`${appt.status}>${to}`] ?? STATUS_NAME[to] ?? statusLabel(to)}
                  </button>
                )}
              </form>
            ))}
          </div>
        </details>

        <nav aria-label={t("Actions")} className="card grid grid-cols-3 gap-1 p-2">
          <a href={`sms:${c.phone}`} className={pillar}><Chat size={22} />{t("Message")}</a>
          <a href={`tel:${c.phone}`} className={pillar}><Phone size={22} />{t("Call")}</a>
          {!paid && ["in_progress", "completed", "en_route", "confirmed", "unconfirmed"].includes(appt.status) && (
            <Link href={`/appointments/${id}/checkout`} className={pillar}><Card2 size={22} />{t("Take payment")}</Link>
          )}
          {appt.address_line ? (
            <AddressLink address={[appt.address_line, appt.zip].filter(Boolean).join(" ")} lat={appt.lat} lng={appt.lng} className={`${pillar} !text-center`}>
              <Pin size={22} />{t("Directions")}
            </AddressLink>
          ) : (
            <span className={`${pillar} opacity-40`}><Pin size={22} />{t("No address")}</span>
          )}
          {["confirmed", "unconfirmed", "en_route"].includes(appt.status) && onMyWay && (
            <OnMyWayButton appointmentId={id} phone={c.phone} text={onMyWay} markEnRoute={appt.status !== "en_route"} className={pillar}>
              <Van size={22} />{t("On my way")}
            </OnMyWayButton>
          )}
          {canMove && <Link href={planHref} className={pillar}><Calendar size={22} />{t("Reschedule")}</Link>}
          {canEditServices && <Link href={`/appointments/${id}/services`} className={pillar}><Pencil size={22} />{t("Edit services")}</Link>}
          <Link href={bookAgainHref} className={pillar}>
            <Plus size={22} />{t("Book again")}
          </Link>
          {canChange && (
            <form action={setStatusAction.bind(null, id, "cancelled")} className="contents">
              <ConfirmButton question={TAKES_OFF.cancelled} className={`${pillar} text-danger hover:bg-danger-soft`}><Close size={22} />{t("Cancel")}</ConfirmButton>
            </form>
          )}
          {canChange && appt.status !== "requested" && (
            <form action={setStatusAction.bind(null, id, "no_show")} className="contents">
              <ConfirmButton question={TAKES_OFF.no_show} className={`${pillar} text-danger hover:bg-danger-soft`}><Hourglass size={22} />{t("No-show")}</ConfirmButton>
            </form>
          )}
          {closed && (
            <form action={setStatusAction.bind(null, id, "unconfirmed")} className="contents">
              <button type="submit" className={pillar}><Check size={22} />{t("Restore")}</button>
            </form>
          )}
        </nav>

        <section className="space-y-2">
          <h2 className="section-label">{t("When")}</h2>
          <div className="card flex items-center gap-3 px-4 py-4">
            <div className="flex-1">
              <p className="text-lg font-bold">{longDayLabel(appt.start_at, tz)}</p>
              <p className="text-muted">{timeLabel(appt.start_at, tz)} – {timeLabel(appt.end_at, tz)} · {minutesLabel(minutes)}</p>
            </div>
            {canMove && <Link href={planHref} aria-label={t("Change the time")} className="rounded-full p-2 text-muted hover:bg-bg"><Pencil size={20} /></Link>}
          </div>
          {(groomers.length > 1 || appt.staff_id !== staff.staffId) && groomer && (
            <div className="card space-y-2 px-4 py-3">
              {sp.groomerBusy && <Notice kind="error">{t("That groomer already has a visit at this time.")}</Notice>}
              <div className="flex items-center gap-3">
                <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: groomer.color }} />
                <span className="flex-1"><span className="text-sm text-muted">{t("Groomer")}</span> <span className="font-semibold">{groomer.name}</span></span>
              </div>
              {/* Finished visits too, so payroll credits whoever really did it. */}
              {otherGroomers.length > 0 && staff.can.all_appointments && !["cancelled", "no_show", "declined"].includes(appt.status) && (
                <form action={assignGroomerAction.bind(null, id)} className="flex gap-2">
                  <select name="staff_id" aria-label={t("Give to")} className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
                    {otherGroomers.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <Button type="submit" kind="secondary">{t("Give to")}</Button>
                </form>
              )}
            </div>
          )}
          {appt.status !== "requested" && !["cancelled", "no_show", "declined"].includes(appt.status) && (
            <Link href={`/appointments/${id}/repeat`} className="card flex items-center gap-3 px-4 py-3.5">
              <span aria-hidden className="text-xl text-success">↻</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{series ? t("Repeat appointment") : t("Repeat this appointment")}</span>
                <span className="block truncate text-sm text-muted">
                  {series
                    ? `${ruleLabel(ymd(series.first, tz), { freq: series.freq, every: series.interval_n, count: series.occurrences, until: series.ends_on })} · ${series.upcoming} more after this one`
                    : t("Every week, every 2 weeks, every month…")}
                </span>
              </span>
              <ChevronRight size={20} className="text-muted" />
            </Link>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="section-label">{t("Pets and services")}</h2>
            {canEditServices && <Link href={`/appointments/${id}/services`} className="text-sm font-semibold text-brand">{t("Edit")}</Link>}
          </div>
          {appt.pets.map((p) => (
            <div key={p.appointment_pet_id} className="card divide-y divide-line">
              <div className="flex items-center gap-3 px-4 py-3">
                <PetPhoto petId={p.pet_id} version={p.photo_version} name={p.name} />
                <div className="min-w-0">
                  <div className="text-lg font-bold">{p.name}</div>
                  <div className="text-sm text-muted">{[p.breed, sizeLabel(p.size_class)].filter(Boolean).join(" · ")}</div>
                  <PetCodeChips codes={codes.get(p.pet_id)} />
                </div>
              </div>
              {vaccines.some((v) => v.pet_id === p.pet_id) && (
                <div className="space-y-1 px-4 py-3">
                  {vaccines.filter((v) => v.pet_id === p.pet_id).map((v) => (
                    <Notice key={v.name} kind={v.expired ? "error" : "warn"}>
                      💉 {alertText(v)}{v.expired ? t(" — ask for the new certificate") : ""}
                    </Notice>
                  ))}
                  <Link href={`/clients/${c.id}/pets/${p.pet_id}`} className="block text-xs font-semibold text-brand">{t("Update vaccines")}</Link>
                </div>
              )}
              {(p.behavior || p.notes) && (
                <div className="space-y-2 px-4 py-3">
                  {p.behavior && <Notice kind="warn">{p.behavior}</Notice>}
                  {p.notes && <p className="whitespace-pre-line text-sm text-muted">{p.notes}</p>}
                </div>
              )}
              {p.services.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{s.name}</span>
                    <span className="flex items-center gap-1 text-sm text-muted"><Clock size={14} />{minutesLabel(s.duration_min)}</span>
                  </span>
                  <span className="font-semibold">{money(s.price_cents)}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="flex justify-between px-1 text-lg font-bold">
            <span>{t("Total")}</span>
            <span>{money(total)}</span>
          </div>
        </section>

        {appt.pets.length > 0 && !closed && (
          <section className="space-y-2" aria-label={t("Cuts")}>
            <h2 className="section-label">{t("How they were groomed")}</h2>
            <div className="card divide-y divide-line">
              {appt.pets.map((p) => {
                const now = cuts.now.get(p.pet_id);
                const last = cuts.last.get(p.pet_id);
                return (
                  <GroomForm key={p.appointment_pet_id} appointmentPetId={p.appointment_pet_id} pet={p.name}
                    now={now ? { blade: now.blade, style: now.style, note: now.note } : null}
                    photoUrl={now?.has_photo ? `/api/grooms/${now.id}/photo?v=${now.v}` : null}
                    last={last ? {
                      blade: last.blade, style: last.style, note: last.note,
                      when: dayLabel(last.day, tz),
                      photoUrl: last.has_photo ? `/api/grooms/${last.id}/photo?v=${last.v}` : null,
                    } : null} />
                );
              })}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="section-label">{t("Customer")}</h2>
          <div className="card divide-y divide-line">
            <Link href={`/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3" aria-label={t("Client profile")}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                {(c.first_name[0] ?? "") + (c.last_name[0] ?? "")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{fullName(c)}</span>
                <TagChips tags={tags.get(c.id)} />
              </span>
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-strong">{t("every {rebookWeeks} weeks", { rebookWeeks: rebookWeeks })}</span>
            </Link>
            <PhoneLink phone={c.phone} label={phoneLabel(c.phone)} className="flex w-full items-center gap-3 px-4 py-3 text-brand">
              <Phone size={18} /> {phoneLabel(c.phone)}
            </PhoneLink>
            {appt.address_line ? (
              <AddressLink address={[appt.address_line, appt.zip].filter(Boolean).join(" ")} lat={appt.lat} lng={appt.lng}
                className="flex w-full items-center gap-3 px-4 py-3 text-brand">
                <Pin size={18} className="shrink-0" /> {appt.address_line}{appt.zip ? ` ${appt.zip}` : ""}
              </AddressLink>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 text-muted"><Pin size={18} /> {" "}{t("No address on file")}</div>
            )}
            {c.access_notes && <div className="px-4 py-3"><Notice kind="info">{c.access_notes}</Notice></div>}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="section-label">{t("Visit notes")}</h2>
          <form action={updateNotesAction.bind(null, id)} className="space-y-2">
            <label className="sr-only" htmlFor="notes">{t("Visit notes")}</label>
            <Textarea id="notes" name="notes" defaultValue={appt.notes ?? ""} placeholder={t("Private notes for this visit")} />
            <Button type="submit" kind="secondary">{t("Save notes")}</Button>
          </form>
        </section>

        {canMove && (
          <section className="scroll-mt-20 space-y-2" id="reschedule">
            <h2 className="section-label">{t("Reschedule")}</h2>
            <Card className="space-y-3">
              <ReschedulePlanner staff={staff} day={planDay} monthOpen={sp.rsm === "1"}
                appt={{ id, staff_id: appt.staff_id, start_at: appt.start_at, end_at: appt.end_at, client: c.first_name }} />
              <Link href={moveHref} className="block text-center text-sm font-semibold text-brand">{t("Open the full day calendar ›")}</Link>
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-muted">{t("Or type the date and time")}</summary>
                <div className="pt-3">
                  <RescheduleForm action={rescheduleAction.bind(null, id)} date={day} time={hm(appt.start_at, tz)} notify={!finishedMove} />
                </div>
              </details>
            </Card>
          </section>
        )}

        {messages.length > 0 && (
          <section className="space-y-2">
            <h2 className="section-label">{t("Messages to the client")}</h2>
            <ul className="card divide-y divide-line overflow-hidden text-sm">
              {messages.map((m) => (
                <li key={m.id} className="flex justify-between gap-3 px-4 py-2.5">
                  <span>
                    {TRIGGER_LABEL[m.template_trigger ?? ""] ?? m.template_trigger} · {m.channel === "sms" ? t("Text") : t("Email")}
                  </span>
                  <span className="text-muted">{MESSAGE_STATUS[m.status] ?? m.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="text-center text-xs text-muted">
          <Link href={`/calendar?date=${ymd(appt.start_at, tz)}`} className="underline">{t("See this day in the calendar")}</Link>
        </p>
        {/* Room for the button fixed at the bottom. */}
        {(primary || appt.status === "completed") && <div aria-hidden className="h-16" />}
      </Page>

      {(primary || appt.status === "completed") && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-3xl">
            {primary ? (
              <div className="flex gap-2">
                <form action={setStatusAction.bind(null, id, primary.to)} className="flex-1">
                  <button type="submit" className={`w-full rounded-2xl py-3.5 text-base font-bold text-white ${primary.to === "in_progress" ? "bg-success" : "bg-brand"}`}>
                    {primary.label}
                  </button>
                </form>
                {/* Forgot "on the way" or the check-in: finish the order straight away. */}
                {NEXT_STATUS[appt.status]?.includes("completed") && primary.to !== "completed" && (
                  <form action={setStatusAction.bind(null, id, "completed")}>
                    <button type="submit" className="h-full rounded-2xl border-2 border-danger px-4 text-sm font-bold text-danger">
                      {t("Finish order")}
                    </button>
                  </form>
                )}
              </div>
            ) : paid ? (
              <Link href={`/appointments/${id}/checkout`} className="block w-full rounded-2xl bg-success py-3.5 text-center text-base font-bold text-white">
                {t("Order finished · See receipt")}
              </Link>
            ) : checkout ? (
              <Link href={`/appointments/${id}/checkout`} className="block w-full rounded-2xl bg-danger py-3.5 text-center text-base font-bold text-white">
                {t("Collect payment {money}", { money: money(Math.max(checkout.invoice.total_cents - checkout.invoice.paid_cents, 0)) })}
              </Link>
            ) : (
              <form action={startCheckoutAction.bind(null, id)}>
                <button type="submit" className="w-full rounded-2xl bg-danger py-3.5 text-base font-bold text-white">{t("Collect payment {money}", { money: money(total) })}</button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Changes that take the visit off the day ask first: one stray tap shouldn't lose a client.
const TAKES_OFF: Record<string, string> = {
  cancelled: "Cancel this appointment? The client gets the cancellation text.",
  no_show: "Mark as no-show? The visit comes off your day.",
  declined: "Decline this request? The client gets a text to pick another time.",
};

// In the menu, the client's confirmation reads as what you are recording.
const MENU_NAME: Record<string, string> = {
  "unconfirmed>confirmed": "Client confirmed",
  "confirmed>unconfirmed": "Client hasn't confirmed",
  "unconfirmed>completed": "Finish order (skip the steps)",
  "confirmed>completed": "Finish order (skip the steps)",
  "en_route>completed": "Finish order (skip check-in)",
};

// Names in the status menu, as the groomer says them.
const STATUS_NAME: Record<string, string> = {
  requested: "Requested",
  unconfirmed: "Not confirmed",
  confirmed: "Confirmed",
  en_route: "On the way",
  in_progress: "Checked in",
  completed: "Finished",
  cancelled: "Cancelled",
  no_show: "No-show",
  declined: "Declined",
};

const STATUS_DOT: Record<string, string> = {
  requested: "bg-warn",
  unconfirmed: "bg-danger",
  confirmed: "bg-success",
  en_route: "bg-sky",
  in_progress: "bg-success",
  completed: "bg-navy",
  paid: "bg-success",
};
