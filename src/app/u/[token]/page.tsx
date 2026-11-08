import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { Button, Card } from "@/components/ui";
import { ClientShell } from "@/components/client-shell";
import { safeReferralCode } from "@/lib/discounts";
import { phoneLabel } from "@/lib/format";
import { regionForPage } from "@/lib/region-server";
import { getI18n } from "@/lib/i18n/server";
import { unsubscribeAction } from "./actions";

export const metadata: Metadata = { title: "Email preferences", robots: { index: false } };

// The link at the bottom of marketing emails. Opening it asks first (link scanners open
// links too); one tap unsubscribes. Visit reminders and confirmations keep coming.
export default async function UnsubscribePage({ params, searchParams }: PageProps<"/u/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f]{24}$/.test(token)) notFound();
  const [c] = await sql<{ business_id: string; first_name: string; out: boolean; business: string; phone: string | null; website_url: string | null; country: string; currency: string }[]>`
    select c.business_id, c.first_name, c.email_unsubscribed_at is not null as out, b.name as business, b.phone, b.website_url, b.country, b.currency
    from clients c join businesses b on b.id = c.business_id where c.marketing_token = ${token}`;
  if (!c) notFound();
  const { lang, t } = await getI18n(sp.lang);
  regionForPage(c, lang);
  return (
    <ClientShell phone={c.phone} phoneLabel={phoneLabel(c.phone)} website={c.website_url} i18n={{ lang, t }} referralCode={await safeReferralCode(c.business_id)}>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <Card className="space-y-4 text-center">
          {c.out ? (
            <>
              <h1 className="text-xl font-bold">{sp.done ? t("You're unsubscribed") : t("You're not getting our news emails")}</h1>
              <p className="text-muted">
                {t("No more promotions from {business}. You'll still get the confirmations and reminders for your visits.", { business: c.business })}
              </p>
              <form action={unsubscribeAction.bind(null, token, true, lang)}>
                <Button type="submit" kind="secondary" className="w-full">{t("Changed my mind: subscribe again")}</Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold">{sp.back ? t("Welcome back, {name}!", { name: c.first_name }) : t("Unsubscribe, {name}?", { name: c.first_name })}</h1>
              <p className="text-muted">
                {sp.back ? t("You'll get news and offers from {business} again.", { business: c.business })
                  : t("You'll stop getting news and offers from {business}. Visit reminders still come.", { business: c.business })}
              </p>
              {!sp.back && (
                <form action={unsubscribeAction.bind(null, token, false, lang)}>
                  <Button type="submit" className="w-full">{t("Unsubscribe")}</Button>
                </form>
              )}
            </>
          )}
        </Card>
      </main>
    </ClientShell>
  );
}
