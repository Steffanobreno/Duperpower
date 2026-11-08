import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { fakeOn, fakePlanOf } from "@/lib/fake-payments";
import { getOwnerI18n } from "@/lib/i18n/server";
import { APP_NAME } from "@/lib/product";
import { I18nProvider } from "@/components/i18n";
import { Button, Card } from "@/components/ui";
import { TestModeBanner } from "@/components/test-mode-banner";
import { fakeCancelAtPeriodEndAction } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Manage subscription") };
}

const usd = (cents: number, locale: string) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

// Test mode's portal (instead of Stripe's): the plan, its next renewal, and cancel at the end of
// the period or resume. Nothing else.
export default async function FakePortalPage() {
  const { t, lang, messages, locale } = await getOwnerI18n();
  const staff = await requireStaff();
  if (staff.role !== "owner" || !fakeOn()) redirect("/billing");
  const p = await fakePlanOf(staff.businessId);
  if (!p) redirect("/billing");
  const date = p.plan_period_end.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" });
  const cancelling = p.plan_cancel_at_period_end;
  return (
    <I18nProvider lang={lang} messages={messages}>
      <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-8">
        <p className="text-center text-sm font-bold uppercase tracking-widest text-[#7d5f10]">{APP_NAME}</p>
        <h1 className="text-center text-2xl font-extrabold">{t("Manage subscription")}</h1>
        <TestModeBanner>{t("Test mode — no real charges")}</TestModeBanner>
        <Card className="space-y-1">
          <p className="font-bold">
            {p.plan_interval === "year" ? t("Yearly") : t("Monthly")} · {usd(p.plan_amount_cents, locale)}{p.plan_interval === "year" ? t("/year") : t("/month")}
          </p>
          <p className={cancelling ? "font-semibold text-danger" : ""}>
            {cancelling ? t("Your plan ends on {date}.", { date }) : t("Next renewal: {date}", { date })}
          </p>
        </Card>
        <form action={fakeCancelAtPeriodEndAction.bind(null, !cancelling)}>
          <Button type="submit" kind={cancelling ? "primary" : "secondary"} className="w-full">
            {cancelling ? t("Resume") : t("Cancel at period end")}
          </Button>
        </form>
        <Link href="/billing" className="block text-center text-sm font-semibold text-brand">← {t("Back to your plan")}</Link>
      </main>
    </I18nProvider>
  );
}
