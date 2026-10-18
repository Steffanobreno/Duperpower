import "server-only";
import type { StaffContext } from "../auth";
import type { TransactionSql } from "postgres";
import { sql } from "../db";

export type InvoiceRow = {
  id: string;
  appointment_id: string | null;
  client_id: string;
  status: "open" | "closed" | "void";
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  tip_cents: number;
  total_cents: number;
  paid_cents: number;
  closed_at: Date | null;
};

export type PaymentRow = {
  id: string;
  method: string;
  amount_cents: number;
  tip_cents: number;
  reference: string | null;
  received_at: Date;
};

export { PAYMENT_METHODS, methodLabel } from "../payment-methods";

export async function getInvoiceForAppointment(staff: StaffContext, appointmentId: string) {
  const [invoice] = await sql<InvoiceRow[]>`
    select * from invoices where appointment_id = ${appointmentId} and business_id = ${staff.businessId}`;
  if (!invoice) return null;
  const items = await sql<{ id: string; kind: string; description: string; amount_cents: number }[]>`
    select id, kind, description, amount_cents from invoice_items where invoice_id = ${invoice.id} order by created_at`;
  const payments = await sql<PaymentRow[]>`
    select id, method, amount_cents, tip_cents, reference, received_at
    from payments where invoice_id = ${invoice.id} order by received_at`;
  return { invoice, items, payments };
}

/** Recomputes the invoice totals from its items, payments and adjustments. */
export async function recalcInvoice(tx: TransactionSql, invoiceId: string) {
  await tx`
    update invoices i set
      subtotal_cents = coalesce((select sum(amount_cents) from invoice_items where invoice_id = i.id and kind <> 'discount'), 0),
      discount_cents = coalesce((select -sum(amount_cents) from invoice_items where invoice_id = i.id and kind = 'discount'), 0),
      tip_cents = coalesce((select sum(tip_cents) from payments where invoice_id = i.id), 0),
      -- a payment's amount pays the bill and its tip goes on top, so both count as paid
      paid_cents = coalesce((select sum(amount_cents + tip_cents) from payments where invoice_id = i.id), 0)
    where i.id = ${invoiceId}`;
  await tx`
    update invoices set total_cents = subtotal_cents - discount_cents + tax_cents + tip_cents
    where id = ${invoiceId}`;
}
