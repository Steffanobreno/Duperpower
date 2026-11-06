import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { allOptions } from "@/lib/data/options";
import { petOptions } from "../../../options";
import { fullName, getClient } from "@/lib/data/clients";
import { Card, Notice, Page, PageHeader } from "@/components/ui";
import { savePetAction } from "../../../actions";
import { PetForm } from "../../../forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("New pet") };
}

export default async function NewPetPage({ params, searchParams }: PageProps<"/clients/[id]/pets/new">) {
  const { t } = await getOwnerI18n();
  const staff = await requireStaff();
  const { id } = await params;
  const first = (await searchParams).first === "1";
  const [client, lists] = await Promise.all([getClient(staff, id), allOptions(staff.businessId)]);
  if (!client) notFound();
  return (
    <>
      <PageHeader title={t("New pet for {name}", { name: fullName(client) })} back={`/clients/${id}`} />
      <Page>
        {first && <Notice kind="success">{t("Client saved. Now add their pet.")}</Notice>}
        <Card>
          <PetForm action={savePetAction.bind(null, id, null)} offerBooking options={petOptions(lists)} />
        </Card>
      </Page>
    </>
  );
}
