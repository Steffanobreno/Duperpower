import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Toast } from "@/components/toast";
import { requireStaff } from "@/lib/auth";
import { clientCounts, fullAddress, fullName, listClients } from "@/lib/data/clients";
import { phoneLabel } from "@/lib/format";
import { clientTagsFor, optionLabels } from "@/lib/data/options";
import { TagChips } from "@/components/chips";
import { ButtonLink, Empty, Page, PageHeader } from "@/components/ui";
import { ClientFinder } from "@/components/client-finder";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const { t: tr } = await getOwnerI18n();
  const staff = await requireStaff();
  const sp = await searchParams;
  const q = String(sp.q ?? "");
  const inactive = sp.show === "inactive";
  const tag = typeof sp.tag === "string" ? sp.tag : "";
  const [clients, counts, tagList] = await Promise.all([
    listClients(staff, q, inactive, tag), clientCounts(staff), optionLabels(staff.businessId, "client_tag"),
  ]);
  const tagsOf = await clientTagsFor(clients.map((c) => c.id));
  const withTag = (t: string) => `/clients?${new URLSearchParams({ ...(q && { q }), ...(inactive && { show: "inactive" }), ...(t && { tag: t }) })}`;
  return (
    <>
      <PageHeader title={tr("Clients")} action={<ButtonLink href="/clients/new">{tr("New client")}</ButtonLink>} />
      <Page>
        {tagList.length > 0 && (
          <nav aria-label={tr("Filter by tag")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {["", ...tagList].map((t) => (
              <Link key={t || "all"} href={withTag(t)} aria-current={t === tag ? "true" : undefined}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${t === tag ? "border-navy bg-navy text-white" : "border-line bg-surface text-muted"}`}>
                {t || tr("All")}
              </Link>
            ))}
          </nav>
        )}
        <p className="px-1 text-sm text-muted">
          CLIENTS <strong className="text-ink">{counts.clients}</strong> {" "}{tr("· DOGS")}{" "} <strong className="text-ink">{counts.pets}</strong>
          {(q || tag) && <> {tr("· {n} found", { n: clients.length })}</>}
          <Link href={inactive ? "/clients" : "/clients?show=inactive"} className="float-right font-semibold text-brand">
            {inactive ? tr("Active clients") : tr("Inactive clients")}
          </Link>
        </p>
        {inactive && <p className="px-1 text-sm font-semibold">{tr("Inactive clients")}</p>}
        {sp.removed && <Toast>{tr("Client removed.")}</Toast>}
        {clients.length === 0 ? (
          <Empty title={q || tag ? tr("No client matches that search") : inactive ? tr("No inactive clients") : tr("No clients yet")}>
            {q ? tr("Try part of the name, the phone number or the pet's name.") : tr("Add your first client to start booking.")}
          </Empty>
        ) : (
          <ClientFinder initialQuery={q} form={<>
            {inactive && <input type="hidden" name="show" value="inactive" />}
            {tag && <input type="hidden" name="tag" value={tag} />}
          </>}>
          <ul className="space-y-2">
            {clients.map((c) => (
              <li key={c.id} data-letter={c.first_name} data-search={[fullName(c), c.phone, c.pet_names, c.pet_breeds, c.city].filter(Boolean).join(" ")}>
                <Link href={`/clients/${c.id}`} className="card flex items-center gap-3 px-4 py-3 hover:bg-bg">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                    {(c.first_name[0] ?? "") + (c.last_name?.[0] ?? "")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{fullName(c)}</span>
                      {c.is_new && <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">{tr("New")}</span>}
                      <TagChips tags={tagsOf.get(c.id)} />
                    </span>
                    <span className="block truncate text-sm">
                      {c.pet_names ? <span className="font-medium">{c.pet_names}</span> : <span className="text-muted">{tr("No pets yet")}</span>}
                      {c.pet_breeds && <span className="text-muted"> · {c.pet_breeds}</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">{[staff.can.client_contact && phoneLabel(c.phone), c.city ?? fullAddress(c)].filter(Boolean).join(" · ")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          </ClientFinder>
        )}
      </Page>
    </>
  );
}
