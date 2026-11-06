import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { headers } from "next/headers";
import { guessCountry, placeNames } from "@/lib/countries";
import { APP_NAME } from "@/lib/product";
import { Card } from "@/components/ui";
import { SignupForm } from "./signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Create your account") };
}
export const dynamic = "force-dynamic";

// A new groomer's account: the business and its owner login, ready to book in a minute.
export default async function SignupPage() {
  const { t, lang } = await getOwnerI18n();
  if (await getStaff()) redirect("/today");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <p className="text-center text-sm font-bold uppercase tracking-widest text-[#a8811f]">{APP_NAME}</p>
      <h1 className="mt-1 text-center text-2xl font-extrabold">{t("Create your grooming business account")}</h1>
      <p className="mb-6 mt-1 text-center text-muted">{t("Your own booking page, calendar, route and checkout. Services and messages come ready; change them anytime.")}</p>
      <Card><SignupForm country={guessCountry(await headers())} names={placeNames(lang)} /></Card>
      <p className="mt-4 text-center text-sm text-muted">
        {t("Already have an account?")}{" "} <Link href="/login" className="font-semibold text-brand">{t("Log in")}</Link>
      </p>
    </main>
  );
}
