import { msg } from "@/lib/i18n";
import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { serviceAreas } from "@/lib/booking";
import { zipInfo } from "@/lib/geo/zip";
import { ButtonLink, Empty, Page, PageHeader } from "@/components/ui";
import { AreaMap } from "./area-map";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Service areas") };
}

const DAYS = [msg("Sun"), msg("Mon"), msg("Tue"), msg("Wed"), msg("Thu"), msg("Fri"), msg("Sat")];

export default async function AreasPage() {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const areas = await serviceAreas(staff.businessId);
  const points = areas.flatMap((a) => a.zip_codes.map((z) => zipInfo(z)).filter((z) => z != null)
    .map((z) => ({ lat: z.lat, lng: z.lng, color: a.color, label: `${a.name}: ${z.city} ${z.zip}` })));
  return (
    <>
      <PageHeader title={t("Service areas")} back="/settings" action={<ButtonLink href="/settings/areas/new">{t("Add area")}</ButtonLink>} />
      <Page>
        <p className="text-sm text-muted">
          {t("Group your ZIP codes into areas and pick the days you go to each one. Online, clients only see times on their area's days, and addresses outside every area can't book. With no areas, only the service radius counts.")}
        </p>
        <AreaMap points={points} />
        {areas.length ? (
          <ul className="card divide-y divide-line overflow-hidden">
            {areas.map((a) => (
              <li key={a.id}>
                <Link href={`/settings/areas/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: a.color }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{a.name}</span>
                    <span className="block text-sm text-muted">
                      {a.weekdays.length === 7 ? t("Every day") : a.weekdays.map((d) => t(DAYS[d])).join(", ")} · {a.zip_codes.length === 1 ? t("1 ZIP code") : t("{n} ZIP codes", { n: a.zip_codes.length })}
                    </span>
                  </span>
                  <span aria-hidden className="text-muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title={t("No service areas yet")}>{t("Clients anywhere inside your service radius can book any day.")}</Empty>
        )}
      </Page>
    </>
  );
}
