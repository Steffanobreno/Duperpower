import "server-only";
import { sql } from "../db";
import { methodLabel } from "../payment-methods";

// A receipt is a closed bill seen by the client: the business, the client and pets, the
// check-in and check-out, each service and price, discounts, charges, tips and how it was
// paid. The same data feeds the receipt page (/r/<token>), the PDF and the email.

export type Receipt = {
  invoiceId: string;
  number: string; // "1001"
  token: string;
  open: boolean;
  business: { id: string; name: string; phone: string | null; address: string | null; timezone: string; logo: string | null };
  client: { id: string; name: string; email: string | null; phone: string | null };
  checkedIn: Date | null;
  checkedOut: Date | null;
  date: Date; // the visit day (or when paid, for a receipt written by hand)
  pets: { name: string; lines: { name: string; cents: number }[] }[];
  adjustments: { kind: "discount" | "fee" | "tax"; label: string; cents: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  tips: number;
  total: number;
  paid: number;
  payments: { method: string; amount: number; tip: number; at: Date; reference: string | null }[];
  emailedAt: Date | null;
  /** Paid in the last two minutes: its email may still be on the way. */
  justClosed: boolean;
};

type Where = { token: string } | { invoiceId: string; businessId: string };

/** One receipt, by its secret link token or (for the owner) by invoice. */
export async function getReceipt(where: Where): Promise<Receipt | null> {
  const [r] = await sql<{
    id: string; receipt_no: number; public_token: string; status: string; subtotal_cents: number; discount_cents: number;
    tax_cents: number; tip_cents: number; total_cents: number; paid_cents: number; created_at: Date; receipt_emailed_at: Date | null; just_closed: boolean;
    business_id: string; business: string; business_phone: string | null; business_address: string | null; timezone: string;
    logo_v: string | null;
    client_id: string; first_name: string; last_name: string; email: string | null; phone: string | null;
    checked_in_at: Date | null; checked_out_at: Date | null; start_at: Date | null;
  }[]>`
    select i.id, i.receipt_no, i.public_token, i.status, i.subtotal_cents, i.discount_cents, i.tax_cents, i.tip_cents,
           i.total_cents, i.paid_cents, i.created_at, i.receipt_emailed_at,
           coalesce(i.closed_at > now() - interval '2 minutes', false) as just_closed,
           b.id as business_id, b.name as business, b.phone as business_phone, b.timezone,
           coalesce(nullif(concat_ws(', ', b.address_line, b.city, nullif(concat_ws(' ', b.state, b.zip), '')), ''),
                    b.mailing_address) as business_address,
           (select extract(epoch from l.updated_at)::bigint::text from business_logos l where l.business_id = b.id) as logo_v,
           c.id as client_id, c.first_name, c.last_name, c.email, c.phone,
           coalesce(a.checked_in_at, i.checked_in_at) as checked_in_at,
           coalesce(a.checked_out_at, i.checked_out_at) as checked_out_at, a.start_at
    from invoices i
    join businesses b on b.id = i.business_id
    join clients c on c.id = i.client_id
    left join appointments a on a.id = i.appointment_id
    where ${"token" in where ? sql`i.public_token = ${where.token}` : sql`i.id = ${where.invoiceId} and i.business_id = ${where.businessId}`}
      and i.status <> 'void'`;
  if (!r) return null;
  const [items, payments] = await Promise.all([
    sql<{ kind: string; description: string; amount_cents: number }[]>`
      select kind, description, amount_cents from invoice_items where invoice_id = ${r.id}
      order by case kind when 'service' then 0 when 'addon' then 1 else 2 end, created_at, description`,
    sql<{ method: string; amount_cents: number; tip_cents: number; received_at: Date; reference: string | null }[]>`
      select method, amount_cents, tip_cents, received_at, reference from payments where invoice_id = ${r.id} order by received_at`,
  ]);
  // Services are saved as "Pet: service"; group them under each pet.
  const pets: Receipt["pets"] = [];
  for (const it of items.filter((x) => !["discount", "fee", "tax"].includes(x.kind))) {
    const [pet, ...rest] = it.description.split(": ");
    const name = rest.length ? pet : "";
    const line = { name: rest.length ? rest.join(": ") : it.description, cents: it.amount_cents };
    const group = pets.find((p) => p.name === name);
    if (group) group.lines.push(line);
    else pets.push({ name, lines: [line] });
  }
  return {
    invoiceId: r.id,
    number: String(r.receipt_no),
    token: r.public_token,
    open: r.status === "open",
    business: {
      id: r.business_id, name: r.business, phone: r.business_phone, address: r.business_address, timezone: r.timezone,
      logo: r.logo_v ? `/logo/${r.business_id}?v=${r.logo_v}` : null,
    },
    client: { id: r.client_id, name: `${r.first_name} ${r.last_name}`.trim(), email: r.email, phone: r.phone },
    checkedIn: r.checked_in_at,
    checkedOut: r.checked_out_at,
    date: r.start_at ?? r.checked_in_at ?? payments[0]?.received_at ?? r.created_at,
    pets,
    adjustments: items
      .filter((x) => ["discount", "fee", "tax"].includes(x.kind))
      .map((x) => ({ kind: x.kind as "discount" | "fee" | "tax", label: x.description, cents: x.amount_cents })),
    subtotal: r.subtotal_cents,
    discount: r.discount_cents,
    tax: r.tax_cents,
    tips: r.tip_cents,
    total: r.total_cents,
    paid: r.paid_cents,
    payments: payments.map((p) => ({ method: methodLabel(p.method), amount: p.amount_cents, tip: p.tip_cents, at: p.received_at, reference: p.reference })),
    emailedAt: r.receipt_emailed_at,
    justClosed: r.just_closed,
  };
}

/** Paid receipts of a business between two moments (by when they were closed), oldest first. */
export async function listReceipts(businessId: string, from: Date, to: Date) {
  return sql<{ id: string; receipt_no: number; client: string; total_cents: number; closed_at: Date; appointment_id: string | null }[]>`
    select i.id, i.receipt_no, trim(c.first_name || ' ' || c.last_name) as client, i.total_cents, i.closed_at, i.appointment_id
    from invoices i join clients c on c.id = i.client_id
    where i.business_id = ${businessId} and i.status = 'closed' and i.closed_at >= ${from} and i.closed_at < ${to}
    order by i.closed_at`;
}

/** The client's receipt address: the secret link, absolute. */
export const receiptUrl = (token: string) => `${(process.env.APP_URL ?? "").replace(/\/$/, "")}/r/${token}`;
