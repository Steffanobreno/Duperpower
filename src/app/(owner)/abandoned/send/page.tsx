import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { draftsToMessage } from "@/lib/data/abandoned";
import { emailConfigured } from "@/lib/email";
import { Empty, Page, PageHeader } from "@/components/ui";
import { SendAll } from "./send-all";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Send to all") };
}

// The texts to start from: the business's own "finish booking" message, or an apology for a
// booking page that didn't work.
const SORRY = "Hi {client}! This is {business} 🐾 Sorry: our booking page had a problem on the last step that kept the Submit button from working. It's fixed now! You can finish booking {pet}'s visit here: {booking_url} Or just reply with a day and time that works for you and we'll book it. Thanks for your patience!";

export default async function SendAllPage() {
  const { t } = await getOwnerI18n();
  const staff = await requireStaff();
  const [people, [tpl]] = await Promise.all([
    draftsToMessage(staff),
    sql<{ body: string; email_subject: string | null }[]>`
      select body, email_subject from message_templates where business_id = ${staff.businessId} and trigger = 'abandoned_booking'`,
  ]);
  return (
    <>
      <PageHeader title={t("Send to all")} back="/abandoned" />
      <Page>
        {people.length === 0 ? (
          <Empty title={t("Nobody to send to")}>{t("Everyone who started booking in the last 30 days has booked since.")}</Empty>
        ) : (
          <SendAll
            count={people.length}
            withEmail={emailConfigured() ? people.filter((p) => p.email).length : 0}
            finish={tpl?.body ?? "Hi {client}! Looks like you didn't get to finish booking {pet}'s visit with {business}. Pick a time here: {booking_url} 🐾"}
            sorry={SORRY}
            subject={tpl?.email_subject ?? "{business}"}
          />
        )}
      </Page>
    </>
  );
}
