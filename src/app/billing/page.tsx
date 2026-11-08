import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { accessOf, billingOn, isFakeId, paymentsMode, PRICES, stripeOn } from "@/lib/billing";
import { sql } from "@/lib/db";
import { getOwnerI18n } from "@/lib/i18n/server";
import { APP_NAME } from "@/lib/product";
import { logoutAction } from "@/app/login/actions";
import { I18nProvider } from "@/components/i18n";
import { Button, Card, Field, Input, Notice } from "@/components/ui";
import { CopyField } from "@/components/copy-field";
import { TestModeBanner } from "@/components/test-mode-banner";
import { renewalNotice } from "@/lib/renewal-notice";
import { referralStats, REFERRAL_CENTS } from "@/lib/discounts";
import { choosePlanAction, manageBillingAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Your plan") };
}

const usd = (cents: number, locale: string) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

// The plan: the free trial, choosing monthly or yearly (Stripe Checkout), and Stripe's portal
// to manage it (in test mode, without Stripe, the fake checkout and portal instead). When the
// trial is over and nothing is paid, the app opens only this page.
export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, lang, messages, locale } = await getOwnerI18n();
  const staff = await requireStaff();
  const sp = await searchParams;
  const [b] = await sql<{ plan_status: string; trial_ends_at: Date | null; plan_interval: string | null; plan_period_end: Date | null;
                          plan_cancel_at_period_end: boolean; stripe_customer_id: string | null }[]>`
    select plan_status, trial_ends_at, plan_interval, plan_period_end, plan_cancel_at_period_end, stripe_customer_id
    from businesses where id = ${staff.businessId}`;
  const access = accessOf(b);
  const testMode = paymentsMode() === "fake";
  // Without a payment provider (neither Stripe nor test mode) nothing is ever locked.
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
              : t("Free trial: {n} days left. Choose a plan with more than 48 hours of the trial left and the first charge is when the trial ends; with 48 hours or less, it's the day you choose.", { n: access.trialDaysLeft ?? 0 });
  // "Manage billing" opens Stripe's portal for a Stripe customer, the test portal for a test one;
  // a customer of the other kind would only bounce back here.
  const canManage = !!b.stripe_customer_id && (isFakeId(b.stripe_customer_id) ? testMode : stripeOn());
  const canChoose = owner && billingOn() && ["trial", "cancelled"].includes(b.plan_status);
  // Referral: owners of businesses that use the app (not courtesy accounts) can invite others.
  const referral = owner && billingOn() ? await referralStats(staff.businessId) : null;
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const typedCode = typeof sp.code === "string" ? sp.code.slice(0, 40) : "";
  return (
    <I18nProvider lang={lang} messages={messages}>
      <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-8">
        <p className="text-center text-sm font-bold uppercase tracking-widest text-[#7d5f10]">{APP_NAME}</p>
        <h1 className="text-center text-2xl font-extrabold">{t("Your plan")}</h1>
        {testMode && <TestModeBanner>{t("Test mode — no real charges")}</TestModeBanner>}
        {sp.done === "1" && <Notice kind="success">{t("Thank you! Your plan is being activated; it takes a few seconds.")}</Notice>}
        {sp.error === "1" && <Notice kind="error">{t("Stripe didn't open. Please try again in a minute.")}</Notice>}
        <Card><p className={access.locked || b.plan_status === "past_due" ? "font-semibold text-danger" : "font-semibold"}>{status}</p></Card>

        {canChoose && (
          // One form: the code (optional) goes with whichever plan is picked.
          <form action={choosePlanAction} className="grid gap-3">
            {sp.terms_error === "1" && <Notice kind="error">{t("Please accept the Terms and the automatic renewal to choose a plan.")}</Notice>}
            {sp.code_error === "bad" && <Notice kind="error">{t("That code doesn't exist or has expired.")}</Notice>}
            {sp.code_error === "own" && <Notice kind="error">{t("That's your own referral code: share it with other groomers.")}</Notice>}
            <Field label={t("Discount or referral code (optional)")}>
              <Input name="code" defaultValue={typedCode} autoComplete="off" autoCapitalize="characters" />
            </Field>
            {(["month", "year"] as const).map((interval) => (
              <div key={interval} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <span>
                  <span className="block font-bold">{interval === "month" ? t("Monthly") : t("Yearly")}</span>
                  <span className="block text-2xl font-extrabold">
                    {usd(PRICES[interval].cents, locale)}<span className="text-sm font-medium text-muted">{interval === "month" ? t("/month") : t("/year")}</span>
                  </span>
                  {interval === "year" && <span className="block text-sm font-semibold text-success">{t("2 months free")}</span>}
                </span>
                <Button type="submit" name="interval" value={interval}>{interval === "month" ? t("Choose monthly") : t("Choose yearly")}</Button>
                <p className="basis-full text-xs text-muted">{renewalNotice(t, interval, usd(PRICES[interval].cents, locale))}</p>
              </div>
            ))}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="accept_terms" required className="mt-1" />
              <span>
                {t("I have read and accept the Terms and the automatic renewal")}{" "}
                (<Link href="/terms" target="_blank" className="font-semibold text-brand underline">{t("Read the Terms")}</Link>)
              </span>
            </label>
            {!testMode && <p className="text-center text-xs text-muted">{t("Secure payment by Stripe. Cancel anytime.")}</p>}
          </form>
        )}
        {owner && canManage && (
          <form action={manageBillingAction}>
            <Button type="submit" kind="secondary" className="w-full">{t("Manage billing (card, invoices, cancel)")}</Button>
          </form>
        )}
        {referral && (
          <Card>
            <h2 className="text-lg font-bold">{t("Refer a groomer: you both save {amount}", { amount: usd(REFERRAL_CENTS, locale) })}</h2>
            <p className="mt-1 text-sm text-muted">
              {t("They get {amount} off their first bill. You get {amount} of credit when they make their first payment.", { amount: usd(REFERRAL_CENTS, locale) })}
            </p>
            <div className="mt-3 space-y-3">
              <CopyField label={t("Your referral link")} value={`${appUrl}/signup?ref=${referral.code}`} />
              <CopyField label={t("Your referral code")} value={referral.code} />
            </div>
            {referral.joined > 0 && (
              <p className="mt-3 text-sm font-semibold">
                {t("{n} joined with your code · {amount} in credit so far", { n: referral.joined, amount: usd(referral.creditCents, locale) })}
              </p>
            )}
          </Card>
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
