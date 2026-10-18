import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { Card, Page, PageHeader } from "@/components/ui";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import clients" };

export default async function ImportPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Import clients" back="/settings" />
      <Page>
        <Card className="space-y-3">
          <p className="text-sm text-muted">
            Upload the client list exported from your old app. Clients are matched by phone number, so importing the same file
            twice does not create duplicates. Pets come with their breed and grooming frequency; set each pet&apos;s size when you
            see them.
          </p>
          <ImportForm />
        </Card>
      </Page>
    </>
  );
}
