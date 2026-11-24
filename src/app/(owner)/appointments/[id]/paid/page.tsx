import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "@/components/app-link";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getAppointment } from "@/lib/data/appointments";
import { fullName } from "@/lib/data/clients";
import { getInvoiceForAppointment, methodLabel } from "@/lib/data/invoices";
import { getReceipt } from "@/lib/data/receipts";
import { ReceiptActions } from "@/components/receipt-actions";
import { addDaysYmd, money, ymd } from "@/lib/format";
import { Notice, Page, PageHeader } from "@/components/ui";
import { emailReceiptFromPaidAction } from "../../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Payment received") };
}

// After an order is paid in full: what came in, the receipt to send, and what to do next.
// The ← goes to Today (the task is done); "Edit order" is the way back into the checkout.

export default async function PaidPage({ params, searchParams }: PageProps<"/appointments/[id]/paid">) {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("payments");
  const { id } = await params;
  const sp = await searchParams;
  const [appt, data] = await Promise.all([getAppointment(staff, id), getInvoiceForAppointment(staff, id)]);
  if (!appt) notFound();
  if (!data || data.invoice.status !== "closed") redirect(`/appointments/${id}/checkout`);
  const { invoice, payments } = data;
  const receipt = await getReceipt({ invoiceId: invoice.id, businessId: staff.businessId });
  const c = appt.client;
  // The next visit: the shortest grooming frequency among the pets, or 6 weeks (as on the visit).
  const frequencies = appt.pets.map((p) => p.rebook_every_days).filter((d): d is number => d != null);
  const nextDate = addDaysYmd(ymd(appt.start_at, staff.timezone), frequencies.length ? Math.min(...frequencies) : 42);
  const methods = [...new Set(payments.map((p) => t(methodLabel(p.method))))].join(" + ");
  const tile = "flex flex-col items-center justify-center gap-1 rounded-2xl bg-surface px-2 py-4 text-center text-sm font-semibold text-brand shadow-[var(--shadow-card)] hover:bg-brand-soft";

  return (
    <>
      <PageHeader title={t("Payment received")} home="/today" />
      <Page>
        <section className="card space-y-2 px-4 py-6 text-center" aria-label={t("Payment received")}>
          <div aria-hidden className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success text-3xl font-bold text-white">✓</div>
          <h2 className="text-2xl font-extrabold">{t("Payment received")}</h2>
          <p className="text-3xl font-extrabold">{money(invoice.paid_cents)}</p>
          {invoice.tip_cents > 0 && <p className="text-sm text-muted">{t("incl. {money} tip", { money: money(invoice.tip_cents) })}</p>}
          <p className="text-sm text-muted">{[fullName(c), appt.pets.map((p) => p.name).join(" & "), methods].filter(Boolean).join(" · ")}</p>
        </section>
        <Notice kind="success">{t("Order finished · Paid in full. Thank you!")}</Notice>

        <nav aria-label={t("What's next")} className="grid grid-cols-2 gap-2">
          <Link href={`/calendar?view=day&date=${nextDate}&pick=book&client=${c.id}`} className={tile}>
            <span aria-hidden className="text-xl">📅</span>{t("Book next visit")}
          </Link>
          <Link href={`/clients/${c.id}`} className={tile}>
            <span aria-hidden className="text-xl">🐾</span>{t("Client history")}
          </Link>
          <Link href={`/receipts/${invoice.id}`} className={tile}>
            <span aria-hidden className="text-xl">🧾</span>{t("See receipt")}
          </Link>
          <Link href="/today" replace className={tile}>
            <span aria-hidden className="text-xl">🏠</span>{t("Back to Today")}
          </Link>
        </nav>

        {receipt && (
          <ReceiptActions r={receipt} emailAction={emailReceiptFromPaidAction.bind(null, id)}
            result={typeof sp.receipt === "string" ? sp.receipt : undefined} />
        )}

        <Link href={`/appointments/${id}/checkout`} className="block py-2 text-center text-sm font-semibold text-muted">
          {t("Edit order")}
        </Link>
      </Page>
    </>
  );
}
