import { ownerI18nFor } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { headers } from "next/headers";
import { guessCountry, placeNames } from "@/lib/countries";

/** Where the visitor came from: ?utm_source= / ?ref=, else the site that linked here. */
function signupSource(sp: Record<string, string | string[] | undefined>, referer: string | null) {
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  // A referral link's code comes first, so the referral is noted even with utm tags too.
  const utm = pick("ref") && pick("utm_source") ? `${pick("ref")} / ${pick("utm_source")}` : pick("ref") || [pick("utm_source"), pick("utm_medium"), pick("utm_campaign")].filter(Boolean).join(" / ");
  if (utm) return utm.slice(0, 120);
  try {
    const host = referer ? new URL(referer).hostname : "";
    return host && !host.includes("localhost") ? host.slice(0, 120) : "";
  } catch {
    return "";
  }
}
import { APP_NAME } from "@/lib/product";
import { Card, Notice } from "@/components/ui";
import { sql } from "@/lib/db";
import { cleanCode } from "@/lib/discounts";
import { SignupForm } from "./signup-form";
import { I18nProvider } from "@/components/i18n";

export async function generateMetadata({ searchParams }: PageProps<"/signup">): Promise<Metadata> {
  const { t } = await ownerI18nFor((await searchParams).lang);
  return { title: t("Create your account") };
}
export const dynamic = "force-dynamic";

// A new groomer's account: the business and its owner login, ready to book in a minute.
export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  // In the language of the site page that sent them here (?lang=), else the phone's.
  const { t, lang, messages } = await ownerI18nFor(sp.lang);
  if (await getStaff()) redirect("/today");
  const ref = cleanCode(sp.ref);
  const [referrer] = /^[A-Z]+-\d{4}$/.test(ref) ? await sql<{ name: string }[]>`select name from businesses where referral_code = ${ref}` : [];
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <p className="text-center text-sm font-bold uppercase tracking-widest text-[#7d5f10]">{APP_NAME}</p>
      <h1 className="mt-1 text-center text-2xl font-extrabold">{t("Create your grooming business account")}</h1>
      <p className="mt-1 text-center text-muted">{t("Your own booking page, calendar, route and checkout. Services and messages come ready; change them anytime.")}</p>
      {/* What people want to know before typing anything: it's free to try and easy to leave. */}
      <ul className="mb-6 mt-3 flex flex-wrap justify-center gap-2 text-sm font-semibold">
        {[t("14 days free"), t("No card needed"), t("Cancel anytime")].map((x) => (
          <li key={x} className="rounded-full bg-success-soft px-3 py-1 text-[#13703a]">✓ {x}</li>
        ))}
      </ul>
      {referrer && <div className="mb-4"><Notice kind="success">{t("Invited by {name}: your first month is free when you choose a plan.", { name: referrer.name })}</Notice></div>}
      <Card><I18nProvider lang={lang} messages={messages}><SignupForm country={guessCountry(await headers())} names={placeNames(lang)} source={signupSource(sp, (await headers()).get("referer"))} lang={lang} /></I18nProvider></Card>
      <p className="mt-4 text-center text-sm text-muted">
        {t("Already have an account?")}{" "} <Link href="/login" className="font-semibold text-brand">{t("Log in")}</Link>
      </p>
    </main>
  );
}
