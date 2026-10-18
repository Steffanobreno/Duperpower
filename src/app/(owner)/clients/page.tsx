import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { fullAddress, fullName, listClients } from "@/lib/data/clients";
import { phoneLabel } from "@/lib/format";
import { ButtonLink, Empty, Input, Page, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const staff = await requireStaff();
  const q = String((await searchParams).q ?? "");
  const clients = await listClients(staff, q);
  return (
    <>
      <PageHeader title="Clients" action={<ButtonLink href="/clients/new">New client</ButtonLink>} />
      <Page>
        <form role="search">
          <label className="sr-only" htmlFor="q">Search clients</label>
          <Input id="q" name="q" type="search" defaultValue={q} placeholder="Search by name, phone or pet" />
        </form>
        {clients.length === 0 ? (
          <Empty title={q ? "No client matches that search" : "No clients yet"}>
            {q ? "Try part of the name, the phone number or the pet's name." : "Add your first client to start booking."}
          </Empty>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {clients.map((c) => (
              <li key={c.id}>
                <Link href={`/clients/${c.id}`} className="block px-4 py-3 hover:bg-bg">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-semibold">{fullName(c)}</span>
                    <span className="shrink-0 text-sm text-muted">{phoneLabel(c.phone)}</span>
                  </div>
                  <div className="truncate text-sm text-muted">
                    {[c.pet_names, c.city ?? fullAddress(c)].filter(Boolean).join(" · ") || "No pets yet"}
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
