import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { clientHistory, fullAddress, fullName, getClient, listClientNotes, listPets } from "@/lib/data/clients";
import { directionsUrl } from "@/lib/directions";
import { dayLabel, money, phoneLabel, sizeLabel, timeLabel } from "@/lib/format";
import { Button, ButtonLink, Card, Empty, Notice, Page, PageHeader, StatusBadge, Textarea } from "@/components/ui";
import { addNoteAction } from "../actions";
import { PetPhoto } from "@/components/pet-photo";
import { activeAgreement, currentSignature } from "@/lib/agreement";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const client = await getClient(staff, id);
  if (!client) notFound();
  const [pets, notes, history] = await Promise.all([
    listPets(staff, id),
    listClientNotes(staff, id),
    clientHistory(staff, id),
  ]);
  const agreement = await activeAgreement(staff.businessId);
  const signature = agreement ? await currentSignature(agreement, id) : null;
  const address = fullAddress(client);
  const tz = staff.timezone;
  // Soonest upcoming first, then the past, most recent first.
  const upcoming = history.filter((a) => a.upcoming).reverse();
  const past = history.filter((a) => !a.upcoming);

  return (
    <>
      <PageHeader
        title={fullName(client)}
        back="/clients"
        action={<ButtonLink kind="secondary" href={`/clients/${id}/edit`}>Edit</ButtonLink>}
      />
      <Page>
        <Card className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <ButtonLink kind="secondary" href={`tel:${client.phone}`}>Call</ButtonLink>
            <ButtonLink kind="secondary" href={`sms:${client.phone}`}>Text</ButtonLink>
            {address && (
              <ButtonLink kind="secondary" href={directionsUrl({ address, lat: client.lat, lng: client.lng })} target="_blank">
                Directions
              </ButtonLink>
            )}
            <ButtonLink href={`/appointments/new?client=${id}`} className="ml-auto">Book</ButtonLink>
          </div>
          <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">Phone</dt>
            <dd>{phoneLabel(client.phone)}</dd>
            {client.email && (
              <>
                <dt className="text-muted">Email</dt>
                <dd className="break-all">{client.email}</dd>
              </>
            )}
            <dt className="text-muted">Address</dt>
            <dd>{address || "Not set"}</dd>
            {client.access_notes && (
              <>
                <dt className="text-muted">Access</dt>
                <dd className="whitespace-pre-line">{client.access_notes}</dd>
              </>
            )}
          </dl>
          {agreement &&
            (signature ? (
              <p className="text-sm text-success">
                Agreement signed {dayLabel(signature.signed_at, tz)} by &quot;{signature.signed_name}&quot;
              </p>
            ) : (
              <p className="text-sm text-muted">Agreement not signed yet (they&apos;ll be asked on their confirm link).</p>
            ))}
          {client.imported_last_service_at && history.length === 0 && (
            <p className="text-sm text-muted">Last visit in the old app: {dayLabel(client.imported_last_service_at, tz)}</p>
          )}
          {!client.sms_consent_at && <Notice kind="warn">No text consent recorded. Automatic texts will not be sent.</Notice>}
          {client.sms_opted_out_at && <Notice kind="warn">This client replied STOP. Texts are blocked.</Notice>}
        </Card>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Pets</h2>
            <ButtonLink kind="ghost" href={`/clients/${id}/pets/new`}>Add pet</ButtonLink>
          </div>
          {pets.length === 0 ? (
            <Empty title="No pets yet">Add a pet before booking.</Empty>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {pets.map((p) => (
                <li key={p.id}>
                  <Link href={`/clients/${id}/pets/${p.id}`} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 hover:bg-bg">
                    <PetPhoto petId={p.id} version={p.photo_version} name={p.name} />
                    <div className="min-w-0">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-sm text-muted">{[p.breed, sizeLabel(p.size_class)].filter(Boolean).join(" · ")}</div>
                      {p.behavior && <div className="mt-1 text-sm text-warn">{p.behavior}</div>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="font-bold">Appointments</h2>
          {history.length === 0 ? (
            <Empty title="No appointments yet" />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
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
          <h2 className="font-bold">Notes</h2>
          <form action={addNoteAction.bind(null, id)} className="space-y-2">
            <label className="sr-only" htmlFor="note">New note</label>
            <Textarea id="note" name="body" placeholder="Add a note about this client" required />
            <Button type="submit" kind="secondary">Add note</Button>
          </form>
          {notes.map((n) => (
            <Card key={n.id} className="text-sm">
              <p className="whitespace-pre-line">{n.body}</p>
              <p className="mt-1 text-xs text-muted">
                {dayLabel(n.created_at, tz)} {timeLabel(n.created_at, tz)}
                {n.staff_name ? ` · ${n.staff_name}` : ""}
              </p>
            </Card>
          ))}
        </section>
      </Page>
    </>
  );
}
