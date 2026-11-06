import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { listPetCodes } from "@/lib/data/options";
import { Card, Empty, Page, PageHeader } from "@/components/ui";
import { deletePetCodeAction, moveOptionAction, savePetCodeAction } from "../actions";
import { PetCodeForm } from "./code-form";
import { PetCodeRow } from "./code-row";

export const metadata: Metadata = { title: "Pet codes" };

export default async function PetCodesPage() {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const codes = await listPetCodes(staff.businessId);
  return (
    <>
      <PageHeader title={t("Pet codes")} back="/settings/lists" />
      <Page>
        <p className="text-sm text-muted">
          {t("Short colored labels you put on a pet (Matted, Biter, Senior, #7 blade…). They show on the pet, the visit and Today.")}
        </p>
        {codes.length ? (
          <ul className="card divide-y divide-line overflow-hidden">
            {codes.map((c, i) => (
              <PetCodeRow key={c.id} code={c} first={i === 0} last={i === codes.length - 1}
                save={savePetCodeAction.bind(null, c.id)}
                move={moveOptionAction.bind(null, "pet_codes", c.id)}
                remove={deletePetCodeAction.bind(null, c.id)} />
            ))}
          </ul>
        ) : (
          <Empty title={t("No pet codes yet")}>{t("Add your first one below.")}</Empty>
        )}
        <section className="space-y-2">
          <h2 className="section-label">{t("New code")}</h2>
          <Card>
            <PetCodeForm action={savePetCodeAction.bind(null, null)} submitLabel={t("Add code")} />
          </Card>
        </section>
      </Page>
    </>
  );
}
