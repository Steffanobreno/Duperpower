import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { ButtonLink, Card, Page, PageHeader } from "@/components/ui";
import { ImportForm } from "./import-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Import and export clients") };
}

export default async function ImportPage() {
  const { t } = await getOwnerI18n();
  await requirePermission("settings");
  return (
    <>
      <PageHeader title={t("Import and export")} back="/settings" />
      <Page>
        <Card className="space-y-3">
          <h2 className="font-bold">{t("Export")}</h2>
          <p className="text-sm text-muted">
            {t("Download every client with their pets, address, last and next visit as a spreadsheet (CSV). Keep a copy as a backup; it can also be imported back here.")}
          </p>
          <ButtonLink href="/api/export/clients" kind="secondary" className="w-full" prefetch={false}>
            {t("Download client list (CSV)")}
          </ButtonLink>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold">{t("Import")}</h2>
          <p className="text-sm text-muted">
            {t("Upload the client list exported from your old app. Clients are matched by phone number, so importing the same file twice does not create duplicates. Pets come with their breed and grooming frequency; set each pet's size when you see them.")}
          </p>
          <ImportForm />
        </Card>
      </Page>
    </>
  );
}
