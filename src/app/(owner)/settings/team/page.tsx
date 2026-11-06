import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { GROOMER_COLORS, listGroomers } from "@/lib/data/staff";
import { phoneLabel } from "@/lib/format";
import { ROLES, type Role } from "@/lib/permissions";
import { Card, Page, PageHeader } from "@/components/ui";
import { ChevronRight } from "@/components/icons";
import { addGroomerAction } from "./actions";
import { GroomerForm } from "./groomer-form";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const team = await listGroomers(staff);
  return (
    <>
      <PageHeader title={t("Team")} back="/settings" />
      <Page>
        <ul className="card divide-y divide-line overflow-hidden">
          {team.map((g) => (
            <li key={g.id}>
              <Link href={`/settings/team/${g.id}`} className={`flex items-center gap-3 px-4 py-3 hover:bg-bg ${g.active ? "" : "opacity-50"}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ background: g.color }}>
                  {g.name[0]?.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{g.name}</span>
                  <span className="block truncate text-sm text-muted">
                    {!g.active && g.role !== "owner" ? t("Not active") : ROLES[g.role as Role]}{g.phone ? ` · ${phoneLabel(g.phone)}` : ""}
                  </span>
                </span>
                <ChevronRight size={20} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
        <Card className="space-y-3">
          <h2 className="font-bold">{t("Add a groomer")}</h2>
          <p className="text-sm text-muted">
            {t("Each groomer gets their own color and their own route on Today. When booking, you choose who does the visit. They start with your working hours.")}
          </p>
          <GroomerForm action={addGroomerAction} colors={GROOMER_COLORS} submit={t("Add groomer")} />
        </Card>
        <ul className="card divide-y divide-line overflow-hidden">
          {[
            ["/settings/team/roles", "Roles and permissions", "What admins and groomers can see and do when they log in"],
            ["/settings/team/clock", "Clock in and out", "Track hours for hourly pay"],
            ["/reports/payroll", "Payroll", "Commission, tips and hours for any dates"],
          ].map(([href, title, text]) => (
            <li key={href}>
              <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-muted">{text}</span>
                </span>
                <ChevronRight size={20} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="px-1 text-xs text-muted">
          {t("Give someone a login on their page to let them log in on their own phone. Online booking requests come to you, and you can assign them to anyone.")}
        </p>
      </Page>
    </>
  );
}
