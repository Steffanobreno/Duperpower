import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { cleanCode, codeErrorUrl } from "@/lib/discounts";
import { fakeOn, fakeQuote } from "@/lib/fake-payments";
import { getOwnerI18n } from "@/lib/i18n/server";
import { APP_NAME } from "@/lib/product";
import { I18nProvider } from "@/components/i18n";
import { Button, Card } from "@/components/ui";
import { TestModeBanner } from "@/components/test-mode-banner";
import { payFakeCheckoutAction } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Confirm your plan") };
}

const usd = (cents: number, locale: string) => new Intl.NumberFormat(locale, {
  style: "currency", currency: "USD", minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2,
}).format(cents / 100);

// Test mode's checkout (instead of Stripe Checkout): the plan, its price, the discount and when
// the first payment is, by the same rules as Stripe's; "Pay (test)" starts the plan, no charge.
export default async function FakeCheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, lang, messages, locale } = await getOwnerI18n();
  const staff = await requireStaff();
  if (staff.role !== "owner" || !fakeOn()) redirect("/billing");
  const sp = await searchParams;
  const interval = sp.interval === "year" ? "year" : "month";
  const code = cleanCode(sp.code);
  const [b] = await sql<{ plan_status: string }[]>`select plan_status from businesses where id = ${staff.businessId}`;
  if (!["trial", "cancelled"].includes(b.plan_status)) redirect("/billing");
  const q = await fakeQuote(staff.businessId, interval, code);
  if ("error" in q) redirect(codeErrorUrl(q.error, code));
  const date = (d: Date) => d.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" });
  const d = q.discount;
  const off = d ? (d.percentOff ? `${d.percentOff}%` : usd(d.amountOffCents ?? 0, locale)) : "";
  const row = (label: string, value: ReactNode, extra?: ReactNode) => (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold">{value}{extra}</dd>
    </div>
  );
  return (
    <I18nProvider lang={lang} messages={messages}>
      <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-8">
        <p className="text-center text-sm font-bold uppercase tracking-widest text-[#7d5f10]">{APP_NAME}</p>
        <h1 className="text-center text-2xl font-extrabold">{t("Confirm your plan")}</h1>
        <TestModeBanner>{t("Test mode — no real charges")}</TestModeBanner>
        <Card>
          <dl className="space-y-2">
            {row(t("Plan"), interval === "month" ? t("Monthly") : t("Yearly"))}
            {row(t("Price"), `${usd(q.priceCents, locale)}${interval === "month" ? t("/month") : t("/year")}`)}
            {d && row(t("Discount"),
              d.kind === "referral" ? t("Referral: first month free") : t("Code {code}: {off} off", { code: d.code ?? "", off }),
              <span className="block text-sm font-normal text-muted">
                {d.duration === "once" ? t("first payment only")
                  : d.duration === "forever" ? t("on every payment") : t("for {n} months", { n: d.months ?? 1 })}
              </span>)}
            {row(t("First payment"), usd(q.firstChargeCents, locale),
              <span className="block text-sm font-normal text-muted">{q.firstChargeAt ? date(q.firstChargeAt) : t("today")}</span>)}
          </dl>
          {q.firstChargeAt && (
            <p className="mt-3 text-sm">{t("Your free trial is kept: the first payment is on {date}.", { date: date(q.firstChargeAt) })}</p>
          )}
        </Card>
        <form action={payFakeCheckoutAction}>
          <input type="hidden" name="interval" value={interval} />
          <input type="hidden" name="code" value={code} />
          <Button type="submit" className="w-full">{t("Pay (test)")}</Button>
        </form>
        <Link href="/billing" className="block text-center text-sm font-semibold text-brand">← {t("Back to your plan")}</Link>
      </main>
    </I18nProvider>
  );
}
