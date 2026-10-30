"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isYmd, zonedToUtc } from "@/lib/format";
import { recalcInvoice } from "@/lib/data/invoices";
import { emailReceipt } from "@/lib/receipt-email";
import { PAYMENT_METHODS } from "@/lib/payment-methods";

export type ReceiptLine = { petId: string; serviceId: string; priceCents: number };
export type NewReceipt = {
  clientId: string;
  lines: ReceiptLine[];
  date: string; // YYYY-MM-DD, the visit day
  checkIn: string; // HH:MM
  checkOut: string; // HH:MM
  method: string;
  tipCents: number;
  email: boolean;
};

/**
 * The receipt generator: a paid receipt for a client, written by hand (a visit from before the
 * app, or one done off the calendar). It's saved as a paid bill without a visit, so it also
 * counts in Finance & reports, and it gets a receipt number, link and PDF like any other.
 */
export async function createReceiptAction(input: NewReceipt): Promise<{ error?: string } | undefined> {
  const staff = await requirePermission("payments");
  const [client] = await sql`select id from clients where id = ${input.clientId} and business_id = ${staff.businessId}`;
  if (!client) return { error: "Choose the client." };
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 40) return { error: "Add at least one service." };
  if (input.lines.some((l) => !Number.isInteger(l.priceCents) || l.priceCents < 0 || l.priceCents > 1_000_000)) return { error: "Check the prices." };
  if (!isYmd(input.date)) return { error: "Pick the date of the visit." };
  const hm = /^\d{2}:\d{2}$/;
  if (!hm.test(input.checkIn) || !hm.test(input.checkOut) || input.checkOut < input.checkIn) return { error: "Check the check-in and check-out times." };
  if (!PAYMENT_METHODS.some((m) => m.value === input.method)) return { error: "Choose how the client paid." };
  if (!Number.isInteger(input.tipCents) || input.tipCents < 0 || input.tipCents > 1_000_000) return { error: "Check the tip." };

  const pets = await sql<{ id: string; name: string }[]>`
    select id, name from pets where client_id = ${input.clientId} and id = any(${[...new Set(input.lines.map((l) => l.petId))]})`;
  const petName = new Map(pets.map((p) => [p.id, p.name]));
  const services = await sql<{ id: string; name: string; kind: string }[]>`
    select id, name, kind from services where business_id = ${staff.businessId} and id = any(${[...new Set(input.lines.map((l) => l.serviceId))]})`;
  const service = new Map(services.map((s) => [s.id, s]));
  if (input.lines.some((l) => !petName.has(l.petId) || !service.has(l.serviceId))) return { error: "Please reload the page and try again." };

  const checkedIn = zonedToUtc(input.date, input.checkIn, staff.timezone);
  const checkedOut = zonedToUtc(input.date, input.checkOut, staff.timezone);
  const servicesCents = input.lines.reduce((s, l) => s + l.priceCents, 0);
  const id = await sql.begin(async (tx) => {
    const [inv] = await tx`
      insert into invoices (business_id, client_id, checked_in_at, checked_out_at)
      values (${staff.businessId}, ${input.clientId}, ${checkedIn}, ${checkedOut}) returning id`;
    for (const l of input.lines) {
      const s = service.get(l.serviceId)!;
      await tx`insert into invoice_items (invoice_id, kind, description, amount_cents)
               values (${inv.id}, ${s.kind === "addon" ? "addon" : "service"}, ${`${petName.get(l.petId)}: ${s.name}`}, ${l.priceCents})`;
    }
    if (servicesCents + input.tipCents > 0) {
      await tx`insert into payments (invoice_id, method, amount_cents, tip_cents, staff_id, received_at)
               values (${inv.id}, ${input.method}, ${servicesCents}, ${input.tipCents}, ${staff.staffId}, ${checkedOut})`;
    }
    await recalcInvoice(tx, inv.id);
    await tx`update invoices set status = 'closed', closed_at = ${checkedOut} where id = ${inv.id}`;
    return inv.id as string;
  });
  const emailed = input.email ? await emailReceipt(staff.businessId, id) : null;
  revalidatePath("/receipts");
  revalidatePath("/reports");
  redirect(`/receipts/${id}${emailed ? `?receipt=${emailed}` : ""}`);
}

/** "Email receipt" for a receipt from the generator. */
export async function emailStandaloneReceiptAction(invoiceId: string) {
  const staff = await requirePermission("payments");
  const result = await emailReceipt(staff.businessId, invoiceId);
  revalidatePath(`/receipts/${invoiceId}`);
  redirect(`/receipts/${invoiceId}?receipt=${result}`);
}
