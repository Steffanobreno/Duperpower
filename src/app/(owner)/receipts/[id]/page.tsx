import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getReceipt } from "@/lib/data/receipts";
import { Card, Page, PageHeader } from "@/components/ui";
import { ReceiptView } from "@/components/receipt-view";
import { ReceiptActions } from "@/components/receipt-actions";
import { emailStandaloneReceiptAction } from "../actions";

export const metadata: Metadata = { title: "Receipt" };

// A receipt from the receipt generator (finished orders show theirs on the order).
export default async function ReceiptPage({ params, searchParams }: PageProps<"/receipts/[id]">) {
  const staff = await requirePermission("payments");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const r = await getReceipt({ invoiceId: id, businessId: staff.businessId });
  if (!r) notFound();
  return (
    <>
      <PageHeader title={`Receipt #${r.number}`} back="/receipts" />
      <Page>
        <ReceiptActions r={r} emailAction={emailStandaloneReceiptAction.bind(null, id)} result={typeof sp.receipt === "string" ? sp.receipt : undefined} />
        <Card><ReceiptView r={r} /></Card>
      </Page>
    </>
  );
}
