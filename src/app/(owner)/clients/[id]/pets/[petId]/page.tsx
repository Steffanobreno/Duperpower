import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getPet } from "@/lib/data/clients";
import { Card, Page, PageHeader } from "@/components/ui";
import { savePetAction } from "../../../actions";
import { PetForm } from "../../../forms";

export const metadata: Metadata = { title: "Edit pet" };

export default async function EditPetPage({ params }: PageProps<"/clients/[id]/pets/[petId]">) {
  const staff = await requireStaff();
  const { id, petId } = await params;
  const pet = await getPet(staff, petId);
  if (!pet || pet.client_id !== id) notFound();
  return (
    <>
      <PageHeader title={`Edit ${pet.name}`} back={`/clients/${id}`} />
      <Page>
        <Card>
          <PetForm action={savePetAction.bind(null, id, petId)} initial={pet} />
        </Card>
      </Page>
    </>
  );
}
