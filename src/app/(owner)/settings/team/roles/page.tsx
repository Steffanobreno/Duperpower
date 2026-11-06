import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PERMISSIONS, ROLES, type Permission } from "@/lib/permissions";
import { Card, Page, PageHeader } from "@/components/ui";
import { SimpleForm } from "../../forms";
import { saveRolePermissionsAction } from "../actions";

export const metadata: Metadata = { title: "Roles and permissions" };

export default async function RolesPage() {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const rows = await sql<{ role: string; perm: string }[]>`select role, perm from role_permissions where business_id = ${staff.businessId}`;
  const has = (role: string, perm: string) => rows.some((r) => r.role === role && r.perm === perm);
  return (
    <>
      <PageHeader title={t("Roles and permissions")} back="/settings/team" />
      <Page>
        <p className="text-sm text-muted">{t("The owner can do everything. Choose what admins and groomers can do when they log in.")}</p>
        {(["admin", "groomer"] as const).map((role) => (
          <section key={role} className="space-y-2">
            <h2 className="section-label">{ROLES[role]}</h2>
            <Card>
              <SimpleForm action={saveRolePermissionsAction.bind(null, role)} submitLabel={`Save ${ROLES[role].toLowerCase()} permissions`}>
                <ul className="divide-y divide-line">
                  {(Object.entries(PERMISSIONS) as [Permission, { title: string; hint: string }][]).map(([perm, p]) => (
                    <li key={perm}>
                      <label className="flex items-center gap-3 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{p.title}</span>
                          {p.hint && <span className="block text-xs text-muted">{p.hint}</span>}
                        </span>
                        <input type="checkbox" name={perm} defaultChecked={has(role, perm)} className="h-5 w-5"
                          aria-label={`${ROLES[role]}: ${p.title}`} />
                      </label>
                    </li>
                  ))}
                </ul>
              </SimpleForm>
            </Card>
          </section>
        ))}
      </Page>
    </>
  );
}
