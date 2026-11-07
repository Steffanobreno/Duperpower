import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { accessOf, billingOn, PRICES } from "@/lib/billing";
import { sql } from "@/lib/db";
import { getOwnerI18n } from "@/lib/i18n/server";
import { APP_NAME } from "@/lib/product";
import { logoutAction } from "@/app/login/actions";
import { I18nProvider } from "@/components/i18n";
import { Button, Card, Notice } from "@/components/ui";
import { choosePlanAction, manageBillingAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Your plan") };
}

const usd = (cents: number, locale: string) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

// The plan: the free trial, choosing monthly or yearly (Stripe Checkout), and Stripe's portal
// to manage it. When the trial is over and nothing is paid, the app opens only this page.
export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, lang, messages, locale } = await getOwnerI18n();
  const staff = await requireStaff();
  const sp = await searchParams;
  const [b] = await sql<{ plan_status: string; trial_ends_at: Date | null; plan_interval: string | null; plan_period_end: Date | null;
                          plan_cancel_at_period_end: boolean; stripe_customer_id: string | null }[]>`
    select plan_status, trial_ends_at, plan_interval, plan_period_end, plan_cancel_at_period_end, stripe_customer_id
    from businesses where id = ${staff.businessId}`;
  const access = accessOf(b);
  // Without Stripe set up nothing is ever locked.
  if (!billingOn()) access.locked = false;
  const owner = staff.role === "owner";
  const date = (d: Date | null) => (d ? d.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" }) : "");
  const status =
    b.plan_status === "free" ? t("Courtesy account: no payment needed.")
      : b.plan_status === "active"
        ? (b.plan_cancel_at_period_end
          ? t("Your plan ends on {date}.", { date: date(b.plan_period_end) })
          : t("{plan} plan · renews on {date}", { plan: b.plan_interval === "year" ? t("Yearly") : t("Monthly"), date: date(b.plan_period_end) }))
        : b.plan_status === "past_due" ? t("The last payment didn't go through. Update your card to keep using the app.")
          : b.plan_status === "cancelled" ? t("Your plan was cancelled. Choose a plan to use the app again; your data is still here.")
            : access.locked ? t("Your free trial has ended. Choose a plan to keep using the app; your data is still here.")
              : t("Free trial: {n} days left. Choose a plan anytime: you won't be charged until the trial ends.", { n: access.trialDaysLeft ?? 0 });
  const canChoose = owner && billingOn() && ["trial", "cancelled"].includes(b.plan_status);
  return (
    <I18nProvider lang={lang} messages={messages}>
      <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-8">
        <p className="text-center text-sm font-bold uppercase tracking-widest text-[#a8811f]">{APP_NAME}</p>
        <h1 className="text-center text-2xl font-extrabold">{t("Your plan")}</h1>
        {sp.done === "1" && <Notice kind="success">{t("Thank you! Your plan is being activated; it takes a few seconds.")}</Notice>}
        {sp.error === "1" && <Notice kind="error">{t("Stripe didn't open. Please try again in a minute.")}</Notice>}
        <Card><p className={access.locked || b.plan_status === "past_due" ? "font-semibold text-danger" : "font-semibold"}>{status}</p></Card>

        {canChoose && (
          <div className="grid gap-3">
            {(["month", "year"] as const).map((interval) => (
              <form key={interval} action={choosePlanAction.bind(null, interval)} className="card flex items-center justify-between gap-3 p-4">
                <span>
                  <span className="block font-bold">{interval === "month" ? t("Monthly") : t("Yearly")}</span>
                  <span className="block text-2xl font-extrabold">
                    {usd(PRICES[interval].cents, locale)}<span className="text-sm font-medium text-muted">{interval === "month" ? t("/month") : t("/year")}</span>
                  </span>
                  {interval === "year" && <span className="block text-sm font-semibold text-success">{t("2 months free")}</span>}
                </span>
                <Button type="submit">{interval === "month" ? t("Choose monthly") : t("Choose yearly")}</Button>
              </form>
            ))}
            <p className="text-center text-xs text-muted">{t("Secure payment by Stripe. Cancel anytime.")}</p>
          </div>
        )}
        {owner && billingOn() && b.stripe_customer_id && (
          <form action={manageBillingAction}>
            <Button type="submit" kind="secondary" className="w-full">{t("Manage billing (card, invoices, cancel)")}</Button>
          </form>
        )}
        {!owner && access.locked && <Notice kind="info">{t("Ask the business owner to choose a plan.")}</Notice>}
        {!billingOn() && owner && b.plan_status !== "free" && <Notice kind="info">{t("Payments aren't set up yet. You can keep using the app.")}</Notice>}

        <div className="flex items-center justify-between pt-2 text-sm">
          {!access.locked ? <Link href="/today" className="font-semibold text-brand">← {t("Back to the app")}</Link> : <span />}
          <form action={logoutAction}><button type="submit" className="font-semibold text-muted">{t("Log out")}</button></form>
        </div>
      </main>
    </I18nProvider>
  );
}
