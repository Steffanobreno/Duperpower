import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaff, hasAnyUser } from "@/lib/auth";
import Link from "next/link";
import { Card } from "@/components/ui";
import { APP_NAME } from "@/lib/product";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Log in") };
}

// Must check the database on every visit, never at build time.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const { t } = await getOwnerI18n();
  if (!(await hasAnyUser())) redirect("/setup");
  if (await getStaff()) redirect("/today");
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <h1 className="mb-1 text-center text-2xl font-bold">{APP_NAME}</h1>
      <p className="mb-6 text-center text-muted">{t("Log in to see your day.")}</p>
      <Card>
        <LoginForm mode="login" />
      </Card>
      <p className="mt-4 text-center text-sm text-muted">
        {t("New here?")}{" "} <Link href="/signup" className="font-semibold text-brand">{t("Create your business account")}</Link>
      </p>
    </main>
  );
}
