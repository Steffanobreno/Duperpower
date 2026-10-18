import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { fullName, getClient, listClients, listPets } from "@/lib/data/clients";
import { listServices } from "@/lib/data/services";
import { isYmd, phoneLabel, todayYmd } from "@/lib/format";
import { ButtonLink, Empty, Input, Page, PageHeader } from "@/components/ui";
import { createAppointmentAction } from "../actions";
import { BookingForm } from "../booking-form";

export const metadata: Metadata = { title: "New appointment" };

export default async function NewAppointmentPage({ searchParams }: PageProps<"/appointments/new">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const clientId = typeof sp.client === "string" ? sp.client : null;
  const date = isYmd(sp.date) ? sp.date : todayYmd(staff.timezone);
  const time = typeof sp.time === "string" && /^\d{2}:\d{2}$/.test(sp.time) ? sp.time : "09:00";
  const client = clientId ? await getClient(staff, clientId) : null;

  // Step 1: pick the client.
  if (!client) {
    const q = String(sp.q ?? "");
    const clients = await listClients(staff, q);
    const keep = `&date=${date}&time=${time}`;
    return (
      <>
        <PageHeader title="Who is it for?" back="/calendar" />
        <Page>
          <form role="search" className="flex gap-2">
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="time" value={time} />
            <label className="sr-only" htmlFor="q">Search clients</label>
            <Input id="q" name="q" type="search" defaultValue={q} placeholder="Search by name, phone or pet" autoFocus />
          </form>
          <ButtonLink kind="secondary" href="/clients/new" className="w-full">New client</ButtonLink>
          {clients.length === 0 ? (
            <Empty title="No client found" />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              {clients.map((c) => (
                <li key={c.id}>
                  <Link href={`/appointments/new?client=${c.id}${keep}`} className="block px-4 py-3 hover:bg-bg">
                    <div className="font-semibold">{fullName(c)}</div>
                    <div className="text-sm text-muted">
                      {[c.pet_names, phoneLabel(c.phone)].filter(Boolean).join(" · ")}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Page>
      </>
    );
  }

  // Step 2: pets, services and time.
  const [pets, services] = await Promise.all([listPets(staff, client.id), listServices(staff)]);
  return (
    <>
      <PageHeader title={`Book ${fullName(client)}`} back={`/clients/${client.id}`} />
      <Page>
        {pets.length === 0 ? (
          <Empty title="This client has no pets yet">
            <ButtonLink href={`/clients/${client.id}/pets/new`} className="mt-2">Add a pet</ButtonLink>
          </Empty>
        ) : (
          <BookingForm
            action={createAppointmentAction.bind(null, client.id)}
            pets={pets}
            services={services}
            defaultDate={date}
            defaultTime={time}
          />
        )}
      </Page>
    </>
  );
}
