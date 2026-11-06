import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { GROOMER_COLORS } from "@/lib/data/staff";
import { phoneLabel } from "@/lib/format";
import { ROLES } from "@/lib/permissions";
import { Card, Field, Input, Page, PageHeader, Select } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { SimpleForm } from "../../forms";
import { removeLoginAction, saveLoginAction, savePayAction, saveRoleAction, saveVanAction, updateGroomerAction } from "../actions";
import { GroomerForm } from "../groomer-form";

export const metadata: Metadata = { title: "Team member" };

type Member = {
  name: string; role: "owner" | "admin" | "groomer"; color: string; phone: string | null; email: string | null; active: boolean;
  login: string | null; commission_pct: number; tips_pct: number; hourly_cents: number;
  van_name: string | null; van_plate: string | null; start_address: string | null; end_address: string | null;
};

export default async function GroomerPage({ params }: PageProps<"/settings/team/[id]">) {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [g] = await sql<Member[]>`
    select s.name, s.role, s.color, s.phone, s.email, s.active, u.email as login,
           s.commission_pct::float8 as commission_pct, s.tips_pct::float8 as tips_pct, s.hourly_cents,
           s.van_name, s.van_plate, s.start_address, s.end_address
    from staff s left join users u on u.id = s.user_id
    where s.id = ${id} and s.business_id = ${staff.businessId}`;
  if (!g) notFound();
  const owner = g.role === "owner";
  return (
    <>
      <PageHeader title={g.name} back="/settings/team" />
      <Page>
        <Card>
          <GroomerForm action={updateGroomerAction.bind(null, id)} colors={GROOMER_COLORS} isOwner={owner} submit={t("Save")}
            initial={{ name: g.name, color: g.color, phone: g.phone ? phoneLabel(g.phone) : "", email: g.email ?? "", active: g.active }} />
        </Card>

        <section className="space-y-2">
          <h2 className="section-label">{t("Role and login")}</h2>
          <Card className="space-y-4">
            {owner ? (
              <p className="text-sm text-muted">{t("Owner: can do everything. Change your own login in Account.")}</p>
            ) : (
              <>
                <SimpleForm action={saveRoleAction.bind(null, id)} submitLabel={t("Save role")}>
                  <Field label={t("Role")} hint={t("What each role can do is in Team → Roles and permissions.")}>
                    <Select name="role" defaultValue={g.role}>
                      <option value="groomer">{ROLES.groomer}</option>
                      <option value="admin">{ROLES.admin}</option>
                    </Select>
                  </Field>
                </SimpleForm>
                <SimpleForm action={saveLoginAction.bind(null, id)} submitLabel={g.login ? t("Change login") : t("Give a login")}
                  savedLabel={t("Login saved. Send them the email and password.")}>
                  <p className="text-sm">
                    {g.login ? <>{t("Logs in as")}{" "} <strong>{g.login}</strong>.</> : `${g.name} can't log in yet.`}
                  </p>
                  <Field label={t("Login email")}>
                    <Input name="email" type="email" defaultValue={g.login ?? g.email ?? ""} required autoComplete="off" />
                  </Field>
                  <Field label={g.login ? t("New password") : t("Password")} hint={t("At least 10 characters. They can change it in Account.")}>
                    <Input name="password" type="text" required minLength={10} autoComplete="off" />
                  </Field>
                </SimpleForm>
                {g.login && (
                  <form action={removeLoginAction.bind(null, id)}>
                    <ConfirmButton question={`${g.name} won't be able to log in anymore. Continue?`}
                      className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-danger hover:bg-danger-soft">
                      {t("Remove login")}
                    </ConfirmButton>
                  </form>
                )}
              </>
            )}
          </Card>
        </section>

        <section className="space-y-2">
          <h2 className="section-label">{t("Van and route")}</h2>
          <Card>
            <SimpleForm action={saveVanAction.bind(null, id)} submitLabel={t("Save van and route")}>
              <div className="grid grid-cols-[1fr_8rem] gap-3">
                <Field label={t("Van")}><Input name="van_name" defaultValue={g.van_name ?? ""} placeholder={t("Ford Transit 2019")} /></Field>
                <Field label={t("License plate")}><Input name="van_plate" defaultValue={g.van_plate ?? ""} /></Field>
              </div>
              <Field label={t("Day starts at")} hint={t("The route on Today starts here (home, where the van parks…).")}>
                <Input name="start_address" defaultValue={g.start_address ?? ""} placeholder={t("123 Main St, San Mateo, CA")} autoComplete="off" />
              </Field>
              <Field label={t("Day ends at")} hint={t("Leave empty to end at the last visit.")}>
                <Input name="end_address" defaultValue={g.end_address ?? ""} placeholder={t("Same as the start")} autoComplete="off" />
              </Field>
            </SimpleForm>
          </Card>
        </section>

        <section className="space-y-2">
          <h2 className="section-label">{t("Pay")}</h2>
          <Card>
            <SimpleForm action={savePayAction.bind(null, id)} submitLabel={t("Save pay")}>
              <div className="grid grid-cols-3 gap-3">
                <Field label={t("Commission %")}><Input name="commission_pct" inputMode="decimal" defaultValue={g.commission_pct} /></Field>
                <Field label={t("Tips %")}><Input name="tips_pct" inputMode="decimal" defaultValue={g.tips_pct} /></Field>
                <Field label={t("Hourly $")}><Input name="hourly" inputMode="decimal" defaultValue={(g.hourly_cents / 100).toFixed(2)} /></Field>
              </div>
              <p className="text-xs text-muted">
                {t("Payroll = commission on the services of their finished visits + their share of tips + hours clocked × hourly pay.")}
              </p>
            </SimpleForm>
          </Card>
        </section>
      </Page>
    </>
  );
}
