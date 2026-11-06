import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { allOptions, listPetCodes, OPTION_KINDS, type OptionKind } from "@/lib/data/options";
import { Page, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Client and pet options" };

const ROWS: { title: string; links: (OptionKind | "pet-codes")[] }[] = [
  { title: "Clients", links: ["client_tag", "referral_source"] },
  { title: "Pets", links: ["pet-codes", "coat_type", "behavior", "vaccine", "breed"] },
];

export default async function ListsPage() {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const [lists, codes] = await Promise.all([allOptions(staff.businessId), listPetCodes(staff.businessId)]);
  return (
    <>
      <PageHeader title={t("Client and pet options")} back="/settings" />
      <Page>
        {ROWS.map((row) => (
          <section key={row.title} className="space-y-2">
            <h2 className="section-label">{row.title}</h2>
            <ul className="card divide-y divide-line overflow-hidden">
              {row.links.map((k) => {
                const title = k === "pet-codes" ? "Pet codes" : OPTION_KINDS[k].title;
                const sample = k === "pet-codes" ? codes.map((c) => c.label) : lists[k].map((o) => o.label);
                return (
                  <li key={k}>
                    <Link href={`/settings/lists/${k}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{title}</div>
                        <div className="truncate text-sm text-muted">
                          {k === "pet-codes" && t("Colored labels on the pet: Matted, Biter, Senior… · ")}
                          {sample.length ? sample.join(", ") : t("None yet")}
                        </div>
                      </div>
                      <span aria-hidden className="text-muted">›</span>
                    </Link>
                  </li>
                );
              })}
              {row.title === "Pets" && (
                <li>
                  <Link href="/settings/services" className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{t("Pet sizes")}</div>
                      <div className="text-sm text-muted">{t("Small, Medium, Large, X-Large by height. Each service has a price per size.")}</div>
                    </div>
                    <span aria-hidden className="text-muted">›</span>
                  </Link>
                </li>
              )}
            </ul>
          </section>
        ))}
      </Page>
    </>
  );
}
