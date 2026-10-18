import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getAppointment } from "@/lib/data/appointments";
import { fullName } from "@/lib/data/clients";
import { getInvoiceForAppointment, methodLabel } from "@/lib/data/invoices";
import { dayLabel, money, timeLabel } from "@/lib/format";
import { Button, Card, Input, Notice, Page, PageHeader, Select } from "@/components/ui";
import {
  addInvoiceItemAction,
  recordPaymentAction,
  removeInvoiceItemAction,
  reopenInvoiceAction,
  startCheckoutAction,
} from "../../actions";
import { PaymentForm } from "../../payment-form";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: PageProps<"/appointments/[id]/checkout">) {
  const staff = await requireStaff();
  const { id } = await params;
  const appt = await getAppointment(staff, id);
  if (!appt) notFound();
  const data = await getInvoiceForAppointment(staff, id);
  const tz = staff.timezone;

  if (!data) {
    return (
      <>
        <PageHeader title="Checkout" back={`/appointments/${id}`} />
        <Page>
          <form action={startCheckoutAction.bind(null, id)}>
            <Button type="submit" className="w-full">Start checkout</Button>
          </form>
        </Page>
      </>
    );
  }

  const { invoice, items, payments } = data;
  const open = invoice.status === "open";
  const balance = invoice.total_cents - invoice.paid_cents;

  return (
    <>
      <PageHeader title={`Checkout · ${fullName(appt.client)}`} back={`/appointments/${id}`} />
      <Page>
        {!open && <Notice kind="success">Paid in full. Thank you!</Notice>}

        <Card className="space-y-2">
          <p className="text-sm text-muted">
            {dayLabel(appt.start_at, tz)} · {timeLabel(appt.start_at, tz)}
          </p>
          <ul className="divide-y divide-line text-sm">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 py-2">
                <span className="flex-1">{item.description}</span>
                <span className={item.amount_cents < 0 ? "text-success" : ""}>{money(item.amount_cents)}</span>
                {open && (
                  <form action={removeInvoiceItemAction.bind(null, id, item.id)}>
                    <button type="submit" className="rounded-lg px-2 text-muted hover:text-danger" aria-label={`Remove ${item.description}`}>
                      ×
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <dl className="space-y-1 border-t border-line pt-2 text-sm">
            <Row label="Subtotal" value={money(invoice.subtotal_cents)} />
            {invoice.discount_cents > 0 && <Row label="Discount" value={`−${money(invoice.discount_cents)}`} />}
            {invoice.tip_cents > 0 && <Row label="Tip" value={money(invoice.tip_cents)} />}
            <Row label="Total" value={money(invoice.total_cents)} strong />
            {invoice.paid_cents > 0 && <Row label="Paid" value={money(invoice.paid_cents)} />}
            {open && <Row label="Still due" value={money(Math.max(balance, 0))} strong />}
          </dl>
        </Card>

        {open && (
          <details className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <summary className="cursor-pointer font-semibold">Add a discount or extra charge</summary>
            <form action={addInvoiceItemAction.bind(null, id)} className="mt-3 grid grid-cols-[7rem_1fr_6rem_auto] items-end gap-2">
              <label className="text-sm">
                <span className="sr-only">Type</span>
                <Select name="kind" defaultValue="discount">
                  <option value="discount">Discount</option>
                  <option value="fee">Charge</option>
                </Select>
              </label>
              <label className="text-sm">
                <span className="sr-only">Description</span>
                <Input name="description" placeholder="Description" />
              </label>
              <label className="text-sm">
                <span className="sr-only">Amount</span>
                <Input name="amount" inputMode="decimal" placeholder="$0.00" required />
              </label>
              <Button type="submit" kind="secondary">Add</Button>
            </form>
          </details>
        )}

        {open && (
          <Card>
            <PaymentForm action={recordPaymentAction.bind(null, id)} balanceCents={Math.max(balance, 0)} />
          </Card>
        )}

        {payments.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-bold">Payments</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="font-medium">{methodLabel(p.method)}</div>
                    <div className="text-muted">
                      {dayLabel(p.received_at, tz)} {timeLabel(p.received_at, tz)}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div>{money(p.amount_cents + p.tip_cents)}</div>
                    {p.tip_cents > 0 && <div className="text-muted">incl. {money(p.tip_cents)} tip</div>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!open && (
          <form action={reopenInvoiceAction.bind(null, id)}>
            <Button type="submit" kind="ghost" className="w-full">Reopen to fix a mistake</Button>
          </form>
        )}
      </Page>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-bold" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
