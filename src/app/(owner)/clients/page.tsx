import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { clientCounts, fullAddress, fullName, listClients } from "@/lib/data/clients";
import { phoneLabel } from "@/lib/format";
import { ButtonLink, Empty, Input, Page, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const staff = await requireStaff();
  const q = String((await searchParams).q ?? "");
  const [clients, counts] = await Promise.all([listClients(staff, q), clientCounts(staff)]);
  return (
    <>
      <PageHeader title="Clients" action={<ButtonLink href="/clients/new">New client</ButtonLink>} />
      <Page>
        <form role="search">
          <label className="sr-only" htmlFor="q">Search clients</label>
          <Input id="q" name="q" type="search" defaultValue={q} placeholder="Search by name, phone or pet" className="rounded-full px-5" />
        </form>
        <p className="px-1 text-sm text-muted">
          CLIENTS <strong className="text-ink">{counts.clients}</strong> · DOGS <strong className="text-ink">{counts.pets}</strong>
          {q && <> · {clients.length} found</>}
        </p>
        {clients.length === 0 ? (
          <Empty title={q ? "No client matches that search" : "No clients yet"}>
            {q ? "Try part of the name, the phone number or the pet's name." : "Add your first client to start booking."}
          </Empty>
        ) : (
          <ul className="space-y-2">
            {clients.map((c) => (
              <li key={c.id}>
                <Link href={`/clients/${c.id}`} className="card flex items-center gap-3 px-4 py-3 hover:bg-bg">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                    {(c.first_name[0] ?? "") + (c.last_name?.[0] ?? "")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{fullName(c)}</span>
                      {c.is_new && <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">New</span>}
                    </span>
                    <span className="block truncate text-sm">
                      {c.pet_names ? <span className="font-medium">{c.pet_names}</span> : <span className="text-muted">No pets yet</span>}
                      {c.pet_breeds && <span className="text-muted"> · {c.pet_breeds}</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">{[phoneLabel(c.phone), c.city ?? fullAddress(c)].filter(Boolean).join(" · ")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Page>
    </>
  );
}
