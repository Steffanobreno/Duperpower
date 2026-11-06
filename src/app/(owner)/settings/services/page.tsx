import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { groupByCategory, listServices } from "@/lib/data/services";
import { minutesLabel, money } from "@/lib/format";
import { ButtonLink, Page, PageHeader } from "@/components/ui";
import { moveServiceAction } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Services") };
}

export default async function ServicesPage() {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const services = await listServices(staff, { includeInactive: true });
  return (
    <>
      <PageHeader title={t("Services and prices")} back="/settings" action={<ButtonLink href="/settings/services/new">{t("Add")}</ButtonLink>} />
      <Page>
        {groupByCategory(services).map(([category, list]) => (
          <section key={category} className="space-y-1">
            <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-muted">{category}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              {list.map((s, i) => (
                <li key={s.id} className="flex items-center">
                  <Link href={`/settings/services/${s.id}`} className="min-w-0 flex-1 px-4 py-3 hover:bg-bg">
                    <div className={`truncate font-medium ${s.active ? "" : "text-muted line-through"}`}>{s.name}</div>
                    <div className="text-sm text-muted">
                      {t(minutesLabel(s.duration_min))}
                      {!s.active && t(" · inactive")}
                    </div>
                  </Link>
                  <span className="px-2 font-semibold text-brand">{money(s.price_cents)}</span>
                  <div className="flex flex-col pr-2">
                    <form action={moveServiceAction.bind(null, s.id, "up")}>
                      <button type="submit" disabled={i === 0} className="px-2 text-muted disabled:opacity-30" aria-label={t("Move {name} up", { name: s.name })}>▲</button>
                    </form>
                    <form action={moveServiceAction.bind(null, s.id, "down")}>
                      <button type="submit" disabled={i === list.length - 1} className="px-2 text-muted disabled:opacity-30" aria-label={t("Move {name} down", { name: s.name })}>▼</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Page>
    </>
  );
}
