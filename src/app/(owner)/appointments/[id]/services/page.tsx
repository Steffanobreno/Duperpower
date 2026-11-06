import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getAppointment } from "@/lib/data/appointments";
import { listServices } from "@/lib/data/services";
import { petPrices } from "@/lib/data/pet-prices";
import { sql } from "@/lib/db";
import { Notice, Page, PageHeader } from "@/components/ui";
import { ServicesEditor } from "./services-editor";

export const metadata: Metadata = { title: "Edit services" };

export default async function EditServicesPage({ params }: PageProps<"/appointments/[id]/services">) {
  const { t } = await getOwnerI18n();
  const staff = await requireStaff();
  const { id } = await params;
  const [appt, services, [invoice]] = await Promise.all([
    getAppointment(staff, id),
    listServices(staff),
    sql<{ status: string }[]>`select status from invoices where appointment_id = ${id} and business_id = ${staff.businessId}`,
  ]);
  if (!appt) notFound();
  // The client's pets (to add one to the visit) and every one's own prices.
  const clientPets = await sql<{ id: string; name: string; breed: string | null; size_class: string | null }[]>`
    select id, name, breed, size_class from pets where client_id = ${appt.client.id} and deceased_at is null order by name`;
  const own = await petPrices(clientPets.map((p) => p.id));
  const ownPricesOf = (petId: string) =>
    Object.fromEntries([...own.values()].filter((r) => r.pet_id === petId)
      .map((r) => [r.service_id, { priceCents: r.price_cents, minutes: r.duration_min }]));
  return (
    <>
      <PageHeader title={t("Edit services")} back={`/appointments/${id}`} />
      <Page>
        {invoice && (
          <Notice kind="info">
            {invoice.status === "closed"
              ? t("This visit is paid. If the new total is higher, the bill opens again so you can collect the rest.")
              : t("Changes update this visit's bill.")}
          </Notice>
        )}
        <ServicesEditor
          appointmentId={id}
          startIso={appt.start_at.toISOString()}
          timezone={staff.timezone}
          pets={appt.pets.map((p) => ({
            appointmentPetId: p.appointment_pet_id,
            petId: p.pet_id,
            name: p.name,
            size: p.size_class,
            ownPrices: ownPricesOf(p.pet_id),
            lines: p.services.map((s) => ({ id: s.id, serviceId: s.service_id, name: s.name, priceCents: s.price_cents, minutes: s.duration_min })),
          }))}
          otherPets={clientPets.filter((cp) => !appt.pets.some((p) => p.pet_id === cp.id)).map((p) => ({
            petId: p.id, name: p.name, breed: p.breed, size: p.size_class, ownPrices: ownPricesOf(p.id), lines: [],
          }))}
          canKeepPrices={staff.can.payments}
          catalog={services.map((s) => ({
            id: s.id, name: s.name, kind: s.kind, size: s.size_class, priceCents: s.price_cents, minutes: s.duration_min,
          }))}
        />
      </Page>
    </>
  );
}
