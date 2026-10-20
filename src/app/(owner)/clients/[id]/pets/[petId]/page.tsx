import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getPet } from "@/lib/data/clients";
import { Card, Page, PageHeader } from "@/components/ui";
import { savePetAction, setPetPassedAction } from "../../../actions";
import { PetPhotoUpload } from "../../../pet-photo-upload";
import { PetPhoto } from "@/components/pet-photo";
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
        <Card className="flex items-center gap-4">
          <PetPhoto petId={petId} version={pet.photo_version} name={pet.name} size={88} />
          <PetPhotoUpload petId={petId} hasPhoto={!!pet.photo_version} />
        </Card>
        <Card>
          <PetForm action={savePetAction.bind(null, id, petId)} initial={pet} />
        </Card>
        <form action={setPetPassedAction.bind(null, id, petId, !pet.deceased_at)} className="text-center">
          <button type="submit" className="text-sm font-semibold text-muted underline">
            {pet.deceased_at ? `Undo: ${pet.name} is still with us` : `${pet.name} passed away 🌈`}
          </button>
          {!pet.deceased_at && <p className="mt-1 text-xs text-muted">Hides {pet.name} from booking and stops reminders. Visit history stays.</p>}
        </form>
      </Page>
    </>
  );
}
