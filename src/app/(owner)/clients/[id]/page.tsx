import { msg } from "@/lib/i18n";
import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-field";
import { emailSignLinkAction } from "../actions";
import { clientTagsFor, petCodesFor } from "@/lib/data/options";
import { PetCodeChips, TagChips } from "@/components/chips";
import { requireStaff } from "@/lib/auth";
import { clientHistory, clientSummary, fullAddress, fullName, getClient, listClientNotes, listPets } from "@/lib/data/clients";
import { AddressLink, PhoneLink } from "@/components/contact-sheet";
import { Chat, Phone } from "@/components/icons";
import { methodLabel } from "@/lib/payment-methods";
import { dayLabel, isUuid, money, phoneLabel, sizeLabel, timeLabel, todayYmd } from "@/lib/format";
import { alertText, vaccineAlerts } from "@/lib/data/vaccines";
import { petPrices } from "@/lib/data/pet-prices";
import { sql } from "@/lib/db";
import { Button, ButtonLink, Card, Empty, Notice, Page, PageHeader, StatusBadge, Textarea } from "@/components/ui";
import { addNoteAction, deleteClientAction, deleteNoteAction, setClientControlAction } from "../actions";
import { PetPhoto } from "@/components/pet-photo";
import { activeAgreement, currentSignature } from "@/lib/agreement";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Client") };
}

export default async function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  const { t } = await getOwnerI18n();
  const sp = await searchParams;
  const staff = await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  // Everything at once: each round trip to the database adds a little wait.
  const [client, pets, notes, history, agreement, summary, passed] = await Promise.all([
    getClient(staff, id),
    listPets(staff, id),
    listClientNotes(staff, id),
    clientHistory(staff, id),
    activeAgreement(staff.businessId),
    clientSummary(staff, id),
    sql<{ id: string; name: string }[]>`select id, name from pets where client_id = ${id} and deceased_at is not null order by name`,
  ]);
  if (!client) notFound();
  const [vaccines, ownPrices, codes, tags] = await Promise.all([
    vaccineAlerts(staff, pets.map((p) => p.id), todayYmd(staff.timezone)),
    petPrices(pets.map((p) => p.id)),
    petCodesFor(pets.map((p) => p.id)),
    clientTagsFor([id]),
  ]);
  const ownPriceCount = (petId: string) => [...ownPrices.values()].filter((r) => r.pet_id === petId).length;
  const signature = agreement ? await currentSignature(agreement, id) : null;
  const signUrl = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/s/${client.sign_token}`;
  const address = fullAddress(client);
  const tz = staff.timezone;
  // Soonest upcoming first, then the past, most recent first.
  const upcoming = history.filter((a) => a.upcoming).reverse();
  const past = history.filter((a) => !a.upcoming);
  const noShows = history.filter((a) => a.status === "no_show").length;
  const frequencies = pets.map((p) => p.rebook_every_days).filter((d): d is number => d != null);
  const preferredDays = frequencies.length ? Math.min(...frequencies) : null;

  return (
    <>
      <PageHeader
        title={fullName(client)}
        back="/clients"
        action={<ButtonLink kind="secondary" href={`/clients/${id}/edit`}>{t("Edit")}</ButtonLink>}
      />
      <Page>
        <div className="card px-4 pb-4 pt-5">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-navy text-xl font-bold text-white">
              {(client.first_name[0] ?? "") + (client.last_name?.[0] ?? "")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-bold">{fullName(client)}</p>
              {client.archived_at && <span className="text-xs font-bold uppercase text-muted">{t("Inactive")}</span>}
            </div>
            <a href={`sms:${client.phone}`} aria-label={t("Text")} className="rounded-full p-2 text-brand hover:bg-brand-soft"><Chat size={24} /></a>
            <a href={`tel:${client.phone}`} aria-label={t("Call")} className="rounded-full p-2 text-brand hover:bg-brand-soft"><Phone size={24} /></a>
          </div>
          <dl className="mt-5 grid grid-cols-4 gap-y-4 text-center">
            {([
              [msg("Upcoming"), String(upcoming.length), ""],
              [msg("Finished"), String(history.filter((a) => a.status === "completed").length), ""],
              [msg("Cancelled"), String(history.filter((a) => a.status === "cancelled").length), ""],
              [msg("No-show"), String(noShows), noShows ? "text-danger" : ""],
              [msg("Total paid"), money(summary.paid + summary.tips), ""],
              [msg("Unpaid"), money(summary.unpaid), summary.unpaid ? "text-danger" : ""],
              [msg("Total appts"), String(history.filter((a) => !["cancelled", "declined"].includes(a.status)).length), ""],
              [msg("Old app"), client.imported_total_sales_cents ? money(client.imported_total_sales_cents) : "—", ""],
            ] as const).map(([label, value, tone]) => (
              <div key={label} className="flex flex-col-reverse">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t(label)}</dt>
                <dd className={`text-lg font-bold tabular-nums ${tone}`}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-x-2">
            <h2 className="section-label">{t("Appointments")}</h2>
            <span className="flex flex-wrap justify-end gap-1">
              <ButtonLink kind="ghost" href={`/waitlist/new?client=${id}`}>{t("+ Waitlist")}</ButtonLink>
              <ButtonLink kind="ghost" href={`/appointments/new?client=${id}`}>{t("+ New appointment")}</ButtonLink>
            </span>
          </div>
          {upcoming[0] && (
            <Link href={`/appointments/${upcoming[0].id}`} className="block rounded-2xl bg-success-soft px-4 py-3">
              <span className="block text-sm font-bold text-success">{t("UPCOMING ({n})", { n: upcoming.length })}</span>
              <span className="block font-semibold">{dayLabel(upcoming[0].start_at, tz)} · {timeLabel(upcoming[0].start_at, tz)}</span>
            </Link>
          )}
          {past[0] && (
            <Link href={`/appointments/${past[0].id}`} className="block rounded-2xl bg-bg px-4 py-3">
              <span className="block text-sm font-bold text-muted">{t("HISTORY ({n})", { n: past.length })}</span>
              <span className="block font-semibold">{dayLabel(past[0].start_at, tz)} · {timeLabel(past[0].start_at, tz)}</span>
            </Link>
          )}
        </section>

        <Card className="space-y-3">
          <h2 className="font-bold">{t("Profile")}</h2>
          <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted">{t("Phone")}</dt>
            <dd>
              {staff.can.client_contact
                ? <PhoneLink phone={client.phone} label={phoneLabel(client.phone)} className="font-semibold text-brand" />
                : <span className="text-muted">{t("Hidden · use Call or Text above")}</span>}
            </dd>
            {client.email && staff.can.client_contact && (
              <>
                <dt className="text-muted">{t("Email")}</dt>
                <dd className="break-all"><a href={`mailto:${client.email}`} className="font-semibold text-brand">{client.email}</a></dd>
              </>
            )}
            <dt className="text-muted">{t("Address")}</dt>
            <dd>
              {address ? (
                <AddressLink address={address} lat={client.lat} lng={client.lng} className="font-semibold text-brand" />
              ) : t("Not set")}
            </dd>
            {client.access_notes && (
              <>
                <dt className="text-muted">{t("Access")}</dt>
                <dd className="whitespace-pre-line">{client.access_notes}</dd>
              </>
            )}
            {(tags.get(id)?.length ?? 0) > 0 && (
              <>
                <dt className="text-muted">{t("Tags")}</dt>
                <dd><TagChips tags={tags.get(id)} /></dd>
              </>
            )}
            {client.referral_source && (
              <>
                <dt className="text-muted">{t("Found you")}</dt>
                <dd>{client.referral_source}</dd>
              </>
            )}
            <dt className="text-muted">{t("Client since")}</dt>
            <dd>{dayLabel(client.imported_last_service_at && client.imported_last_service_at < client.created_at ? client.imported_last_service_at : client.created_at, tz)}</dd>
          </dl>
          {agreement &&
            (signature ? (
              <div className="space-y-1">
                <p className="text-sm text-success">
                  {t("Agreement signed {dayLabel} by \"{signed_name}\"", { dayLabel: dayLabel(signature.signed_at, tz), signed_name: signature.signed_name })}
                </p>
                {signature.signature_url && (
                  // eslint-disable-next-line @next/next/no-img-element -- the signature is a data URL
                  <img src={signature.signature_url} alt={t("Signature of {signed_name}", { signed_name: signature.signed_name })} className="h-16 rounded-lg border border-line bg-white" />
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted">{t("Agreement not signed yet (they'll be asked on their confirm link).")}</p>
                <div className="flex flex-wrap gap-2">
                  <a href={`sms:${client.phone}?&body=${encodeURIComponent(t("Hi {first_name}! Please sign our service agreement here: {signUrl}", { first_name: client.first_name, signUrl }))}`}
                    className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-brand">{t("Text sign link")}</a>
                  {client.email && (
                    <form action={emailSignLinkAction.bind(null, id)}>
                      <button type="submit" className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-brand">{t("Email sign link")}</button>
                    </form>
                  )}
                  <CopyButton value={signUrl} label={t("Copy link")} />
                </div>
                {sp.signLink === "sent" && <p role="status" className="text-sm text-success">{t("Sign link emailed.")}</p>}
                {sp.signLink === "failed" && <p role="alert" className="text-sm text-danger">{t("The email didn't go out. Check the email setup in Texts and email.")}</p>}
              </div>
            ))}
          {client.imported_last_service_at && history.length === 0 && (
            <p className="text-sm text-muted">{t("Last visit in the old app: {dayLabel}", { dayLabel: dayLabel(client.imported_last_service_at, tz) })}</p>
          )}
          {!client.sms_consent_at && <Notice kind="warn">{t("No text consent recorded. Automatic texts will not be sent.")}</Notice>}
          {client.sms_opted_out_at && <Notice kind="warn">{t("This client replied STOP. Texts are blocked.")}</Notice>}
        </Card>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="section-label">{t("Pets")}</h2>
            <ButtonLink kind="ghost" href={`/clients/${id}/pets/new`}>{t("Add pet")}</ButtonLink>
          </div>
          {passed.length > 0 && (
            <p className="px-1 text-sm text-muted">
              {t("In memory 🌈")}{" "}
              {passed.map((p, i) => (
                <span key={p.id}>{i > 0 && ", "}<Link href={`/clients/${id}/pets/${p.id}`} className="underline">{p.name}</Link></span>
              ))}
            </p>
          )}
          {pets.length === 0 ? (
            <Empty title={t("No pets yet")}>{t("Add a pet before booking.")}</Empty>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {pets.map((p) => (
                <li key={p.id}>
                  <Link href={`/clients/${id}/pets/${p.id}`} className="card flex items-center gap-3 p-3 hover:bg-bg">
                    <PetPhoto petId={p.id} version={p.photo_version} name={p.name} />
                    <div className="min-w-0">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-sm text-muted">{[p.breed, t(sizeLabel(p.size_class))].filter(Boolean).join(" · ")}</div>
                      {(codes.has(p.id) || p.behavior_tags.length > 0) && (
                        <div className="mt-1 flex flex-wrap gap-1"><PetCodeChips codes={codes.get(p.id)} /><TagChips tags={p.behavior_tags} /></div>
                      )}
                      {vaccines.filter((v) => v.pet_id === p.id).map((v) => (
                        <div key={v.name} className={`text-xs font-semibold ${v.expired ? "text-danger" : "text-warn"}`}>💉 {alertText(v)}</div>
                      ))}
                      {p.behavior && <div className="mt-1 text-sm text-warn">{p.behavior}</div>}
                      {ownPriceCount(p.id) > 0 && (
                        <div className="text-xs font-semibold text-brand">
                          {t("{ownPriceCount} price", { ownPriceCount: ownPriceCount(p.id) })}{ownPriceCount(p.id) > 1 ? "s" : ""} {t("just for {name}", { name: p.name })}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="section-label">{t("All appointments")}</h2>
          {history.length === 0 ? (
            <Empty title={t("No appointments yet")} />
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {[...upcoming, ...past].map((a) => (
                <li key={a.id}>
                  <Link href={`/appointments/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {dayLabel(a.start_at, tz)} · {timeLabel(a.start_at, tz)}
                      </div>
                      <div className="truncate text-sm text-muted">{a.pets}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div>{money(a.total_cents)}</div>
                      <StatusBadge status={a.paid ? "paid" : a.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="section-label">{t("Payment history")}</h2>
          <div className="card divide-y divide-line">
            <div className="grid grid-cols-2 px-4 py-3 text-sm">
              <span><span className="text-muted">{t("Total paid")}{" "} </span><strong>{money(summary.paid + summary.tips)}</strong></span>
              <span><span className="text-muted">{t("Unpaid")}{" "} </span><strong className={summary.unpaid ? "text-danger" : ""}>{money(summary.unpaid)}</strong></span>
            </div>
            {summary.payments.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">{t("No payments recorded in this app yet.")}</p>
            ) : (
              summary.payments.map((p) => (
                <Link key={p.id} href={p.appointment_id ? `/appointments/${p.appointment_id}/checkout` : "#"} className="flex justify-between gap-3 px-4 py-2.5 text-sm hover:bg-bg">
                  <span>{dayLabel(p.received_at, tz)} · {t(methodLabel(p.method))}</span>
                  <span className="font-semibold tabular-nums">
                    {money(p.amount_cents + p.tip_cents)}
                    {p.tip_cents > 0 && <span className="font-normal text-muted"> {t("(tip {money})", { money: money(p.tip_cents) })}</span>}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="section-label">{t("Preference")}</h2>
          <dl className="card divide-y divide-line text-sm">
            <div className="flex justify-between px-4 py-3">
              <dt className="text-muted">{t("Preferred frequency")}</dt>
              <dd className="font-semibold">{preferredDays ? t("{n} weeks", { n: Math.round(preferredDays / 7) }) : t("Not set (edit the pet)")}</dd>
            </div>
            <div className="flex justify-between px-4 py-3">
              <dt className="text-muted">{t("Actual frequency")}</dt>
              <dd className="font-semibold">{summary.actualDays ? t("{n} days", { n: summary.actualDays }) : "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="space-y-2">
          <h2 className="section-label">{t("Business control")}</h2>
          <div className="card divide-y divide-line">
            <Toggle clientId={id} control="inactive" on={!!client.archived_at} label={t("Inactive customer")} hint={t("Hidden from the client list")} />
            <Toggle clientId={id} control="block_messages" on={!!client.sms_opted_out_at} label={t("Block messages")} hint={t("No automatic texts")} />
            <Toggle clientId={id} control="block_online" on={client.online_booking_blocked} label={t("Block online booking")} hint={t("They're asked to text you instead")} />
            <Toggle clientId={id} control="no_marketing" on={!!client.email_unsubscribed_at} label={t("No marketing emails")} hint={t("Left out of email campaigns (they can unsubscribe themselves too)")} />
          </div>
        </section>

        <details className="card px-4 py-3">
          <summary className="cursor-pointer font-semibold text-danger">{t("Remove client")}</summary>
          <div className="mt-3 space-y-3 text-sm">
            <p>
              {t("This deletes {fullName} for good, with {n} pet", { fullName: fullName(client), n: pets.length })}{pets.length === 1 ? "" : "s"},{" "}
              {t("{n} visit", { n: history.length })}{history.length === 1 ? "" : "s"}
              {summary.paid + summary.tips > 0 ? t(" and {amount} in payments (they leave your reports)", { amount: money(summary.paid + summary.tips) }) : ""}{t(". It can't be undone. To just hide them, use")}{" "} <strong>{t("Inactive customer")}</strong> {" "}{t("above.")}
            </p>
            <form action={deleteClientAction.bind(null, id)}>
              <button type="submit" className="w-full rounded-xl bg-danger py-3 font-bold text-white">{t("Yes, remove {first_name} forever", { first_name: client.first_name })}</button>
            </form>
          </div>
        </details>

        <section className="space-y-2">
          <h2 className="section-label">{t("Notes")}</h2>
          <form action={addNoteAction.bind(null, id)} className="space-y-2">
            <label className="sr-only" htmlFor="note">{t("New note")}</label>
            <Textarea id="note" name="body" placeholder={t("Add a note about this client")} required />
            <Button type="submit" kind="secondary">{t("Add note")}</Button>
          </form>
          {notes.map((n) => (
            <Card key={n.id} className="text-sm">
              <p className="whitespace-pre-line">{n.body}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-muted">
                <span>
                  {dayLabel(n.created_at, tz)} {timeLabel(n.created_at, tz)}
                  {n.staff_name ? ` · ${n.staff_name}` : ""}
                </span>
                <form action={deleteNoteAction.bind(null, id, n.id)}>
                  <button type="submit" className="font-semibold text-danger">{t("Delete")}</button>
                </form>
              </div>
            </Card>
          ))}
        </section>
      </Page>
    </>
  );
}

function Toggle({ clientId, control, on, label, hint }: {
  clientId: string; control: "inactive" | "block_messages" | "block_online" | "no_marketing"; on: boolean; label: string; hint: string;
}) {
  return (
    <form action={setClientControlAction.bind(null, clientId, control, !on)}>
      <button type="submit" role="switch" aria-checked={on} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span>
          <span className="block font-medium">{label}</span>
          <span className="block text-xs text-muted">{hint}</span>
        </span>
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-brand" : "bg-line"}`}>
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
        </span>
      </button>
    </form>
  );
}
