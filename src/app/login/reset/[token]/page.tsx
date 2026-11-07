import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { I18nProvider } from "@/components/i18n";
import { resetLinkOk } from "@/lib/auth";
import { getOwnerI18n } from "@/lib/i18n/server";
import { ResetForm } from "./reset-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Choose a new password"), robots: { index: false } };
}

export const dynamic = "force-dynamic";

// The link from the "Forgot your password?" email.
export default async function ResetPage({ params }: PageProps<"/login/reset/[token]">) {
  const { token } = await params;
  const { t, lang, messages } = await getOwnerI18n();
  const ok = await resetLinkOk(token);
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <h1 className="mb-6 text-center text-2xl font-bold">{t("Choose a new password")}</h1>
      <Card>
        {ok ? (
          <I18nProvider lang={lang} messages={messages}><ResetForm token={token} /></I18nProvider>
        ) : (
          <div className="space-y-4 text-center">
            <p>{t("This link has expired or was already used.")}</p>
            <Link href="/login/forgot" className="font-semibold text-brand">{t("Send a new link")}</Link>
          </div>
        )}
      </Card>
    </main>
  );
}
