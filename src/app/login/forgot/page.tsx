import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { I18nProvider } from "@/components/i18n";
import { getOwnerI18n } from "@/lib/i18n/server";
import { ForgotForm } from "./forgot-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Forgot your password?"), robots: { index: false } };
}

export const dynamic = "force-dynamic";

export default async function ForgotPage() {
  const { t, lang, messages } = await getOwnerI18n();
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <h1 className="mb-1 text-center text-2xl font-bold">{t("Forgot your password?")}</h1>
      <p className="mb-6 text-center text-muted">{t("Type your account email. We'll send you a link to choose a new password.")}</p>
      <Card>
        <I18nProvider lang={lang} messages={messages}><ForgotForm /></I18nProvider>
      </Card>
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="font-semibold text-brand">{t("Back to log in")}</Link>
      </p>
    </main>
  );
}
