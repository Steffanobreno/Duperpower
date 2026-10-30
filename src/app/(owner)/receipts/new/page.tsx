import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { listServices } from "@/lib/data/services";
import { todayYmd } from "@/lib/format";
import { Page, PageHeader } from "@/components/ui";
import { ReceiptGenerator } from "./receipt-generator";

export const metadata: Metadata = { title: "New receipt" };

export default async function NewReceiptPage({ searchParams }: PageProps<"/receipts/new">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const [clients, pets, services, own] = await Promise.all([
    sql<{ id: string; name: string; email: string | null }[]>`
      select id, trim(first_name || ' ' || last_name) as name, email from clients
      where business_id = ${staff.businessId} order by first_name, last_name`,
    sql<{ id: string; client_id: string; name: string; size_class: string | null }[]>`
      select p.id, p.client_id, p.name, p.size_class from pets p join clients c on c.id = p.client_id
      where c.business_id = ${staff.businessId} and p.deceased_at is null order by p.name`,
    listServices(staff),
    sql<{ pet_id: string; service_id: string; price_cents: number }[]>`
      select x.pet_id, x.service_id, x.price_cents from pet_service_prices x
      join pets p on p.id = x.pet_id join clients c on c.id = p.client_id where c.business_id = ${staff.businessId}`,
  ]);
  return (
    <>
      <PageHeader title="New receipt" back="/receipts" />
      <Page>
        <p className="px-1 text-sm text-muted">
          Write a paid receipt for a client: pick the dog, the services and how they paid. It&apos;s saved like a finished
          order (it shows in Finance &amp; reports) and you can send it as a PDF.
        </p>
        <ReceiptGenerator
          clients={clients}
          pets={pets}
          services={services.map((s) => ({ id: s.id, name: s.name, kind: s.kind, size: s.size_class, priceCents: s.price_cents }))}
          ownPrices={own}
          today={todayYmd(staff.timezone)}
          defaultClient={typeof sp.client === "string" ? sp.client : ""}
        />
      </Page>
    </>
  );
}
