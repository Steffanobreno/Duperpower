import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getPet, listVaccines } from "@/lib/data/clients";
import { Button, Card, Input, Page, PageHeader, Select } from "@/components/ui";
import { addVaccineAction, deleteVaccineAction, savePetAction } from "../../../actions";
import { PetForm } from "../../../forms";

export const metadata: Metadata = { title: "Edit pet" };

export default async function EditPetPage({ params }: PageProps<"/clients/[id]/pets/[petId]">) {
  const staff = await requireStaff();
  const { id, petId } = await params;
  const pet = await getPet(staff, petId);
  if (!pet || pet.client_id !== id) notFound();
  const vaccines = await listVaccines(staff, petId);
  return (
    <>
      <PageHeader title={`Edit ${pet.name}`} back={`/clients/${id}`} />
      <Page>
        <Card>
          <PetForm action={savePetAction.bind(null, id, petId)} initial={pet} />
        </Card>

        <section className="space-y-2">
          <h2 className="font-bold">Vaccines</h2>
          {vaccines.length > 0 && (
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface text-sm">
              {vaccines.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-4 py-2">
                  <div className="flex-1">
                    <div className="font-medium">{v.name}</div>
                    <div className={v.expired ? "text-danger" : v.soon ? "text-warn" : "text-muted"}>
                      {v.expires_on ? `${v.expired ? "Expired" : "Expires"} ${v.expires_on}` : "No expiry date"}
                      {v.given_on ? ` · given ${v.given_on}` : ""}
                    </div>
                  </div>
                  <form action={deleteVaccineAction.bind(null, petId, v.id)}>
                    <button type="submit" className="px-2 text-muted hover:text-danger" aria-label={`Remove ${v.name}`}>×</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addVaccineAction.bind(null, petId)} className="grid grid-cols-2 gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-3 text-sm">
            <label className="col-span-2 space-y-1">
              <span className="font-medium">Vaccine</span>
              <Select name="name" defaultValue="Rabies">
                {["Rabies", "DHPP", "Bordetella", "Leptospirosis", "Canine influenza", "Other"].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </Select>
            </label>
            <label className="col-span-2 space-y-1">
              <span className="font-medium">If other, its name</span>
              <Input name="other_name" />
            </label>
            <label className="space-y-1">
              <span className="font-medium">Given</span>
              <Input type="date" name="given_on" />
            </label>
            <label className="space-y-1">
              <span className="font-medium">Expires</span>
              <Input type="date" name="expires_on" />
            </label>
            <Button type="submit" kind="secondary" className="col-span-2">Add vaccine</Button>
          </form>
        </section>
      </Page>
    </>
  );
}
