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
import { removeLoginAction, saveLoginAction, savePayAction, saveRoleAction, updateGroomerAction } from "../actions";
import { GroomerForm } from "../groomer-form";

export const metadata: Metadata = { title: "Team member" };

type Member = {
  name: string; role: "owner" | "admin" | "groomer"; color: string; phone: string | null; email: string | null; active: boolean;
  login: string | null; commission_pct: number; tips_pct: number; hourly_cents: number;
};

export default async function GroomerPage({ params }: PageProps<"/settings/team/[id]">) {
  const staff = await requirePermission("settings");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [g] = await sql<Member[]>`
    select s.name, s.role, s.color, s.phone, s.email, s.active, u.email as login,
           s.commission_pct::float8 as commission_pct, s.tips_pct::float8 as tips_pct, s.hourly_cents
    from staff s left join users u on u.id = s.user_id
    where s.id = ${id} and s.business_id = ${staff.businessId}`;
  if (!g) notFound();
  const owner = g.role === "owner";
  return (
    <>
      <PageHeader title={g.name} back="/settings/team" />
      <Page>
        <Card>
          <GroomerForm action={updateGroomerAction.bind(null, id)} colors={GROOMER_COLORS} isOwner={owner} submit="Save"
            initial={{ name: g.name, color: g.color, phone: g.phone ? phoneLabel(g.phone) : "", email: g.email ?? "", active: g.active }} />
        </Card>

        <section className="space-y-2">
          <h2 className="section-label">Role and login</h2>
          <Card className="space-y-4">
            {owner ? (
              <p className="text-sm text-muted">Owner: can do everything. Change your own login in Account.</p>
            ) : (
              <>
                <SimpleForm action={saveRoleAction.bind(null, id)} submitLabel="Save role">
                  <Field label="Role" hint="What each role can do is in Team → Roles and permissions.">
                    <Select name="role" defaultValue={g.role}>
                      <option value="groomer">{ROLES.groomer}</option>
                      <option value="admin">{ROLES.admin}</option>
                    </Select>
                  </Field>
                </SimpleForm>
                <SimpleForm action={saveLoginAction.bind(null, id)} submitLabel={g.login ? "Change login" : "Give a login"}
                  savedLabel="Login saved. Send them the email and password.">
                  <p className="text-sm">
                    {g.login ? <>Logs in as <strong>{g.login}</strong>.</> : `${g.name} can't log in yet.`}
                  </p>
                  <Field label="Login email">
                    <Input name="email" type="email" defaultValue={g.login ?? g.email ?? ""} required autoComplete="off" />
                  </Field>
                  <Field label={g.login ? "New password" : "Password"} hint="At least 10 characters. They can change it in Account.">
                    <Input name="password" type="text" required minLength={10} autoComplete="off" />
                  </Field>
                </SimpleForm>
                {g.login && (
                  <form action={removeLoginAction.bind(null, id)}>
                    <ConfirmButton question={`${g.name} won't be able to log in anymore. Continue?`}
                      className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-danger hover:bg-danger-soft">
                      Remove login
                    </ConfirmButton>
                  </form>
                )}
              </>
            )}
          </Card>
        </section>

        <section className="space-y-2">
          <h2 className="section-label">Pay</h2>
          <Card>
            <SimpleForm action={savePayAction.bind(null, id)} submitLabel="Save pay">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Commission %"><Input name="commission_pct" inputMode="decimal" defaultValue={g.commission_pct} /></Field>
                <Field label="Tips %"><Input name="tips_pct" inputMode="decimal" defaultValue={g.tips_pct} /></Field>
                <Field label="Hourly $"><Input name="hourly" inputMode="decimal" defaultValue={(g.hourly_cents / 100).toFixed(2)} /></Field>
              </div>
              <p className="text-xs text-muted">
                Payroll = commission on the services of their finished visits + their share of tips + hours clocked × hourly pay.
              </p>
            </SimpleForm>
          </Card>
        </section>
      </Page>
    </>
  );
}
