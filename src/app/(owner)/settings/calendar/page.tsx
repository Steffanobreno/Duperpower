import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { Card, Notice, Page, PageHeader } from "@/components/ui";
import { CopyField } from "@/components/copy-field";

export const metadata: Metadata = { title: "Google Calendar" };

export default async function CalendarSettingsPage() {
  const staff = await requireStaff();
  const [b] = await sql`select device_key from businesses where id = ${staff.businessId}`;
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const feed = `${appUrl}/api/device/calendar?key=${b.device_key}`;
  return (
    <>
      <PageHeader title="Google Calendar" back="/settings" />
      <Page>
        <Card className="space-y-3">
          <p className="text-sm text-muted">
            Every visit (and every online request) shows up in your Google Calendar with the pets, services, phone and address.
            Google checks for changes on its own, usually every few hours.
          </p>
          <CopyField label="Your calendar link (keep it private)" value={feed} />
        </Card>
        <Card className="space-y-2">
          <h2 className="font-bold">Add it to the Woofers Google account</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Copy the link above.</li>
            <li>
              On a computer, open <strong>calendar.google.com</strong> with the Woofers account. On the iPhone, open it in Safari
              and choose <strong>Request Desktop Website</strong> (aA menu).
            </li>
            <li>
              On the left, next to <strong>Other calendars</strong>, tap <strong>+</strong> → <strong>From URL</strong>.
            </li>
            <li>
              Paste the link → <strong>Add calendar</strong>. It appears as &quot;Woofers Dog Spa&quot;.
            </li>
          </ol>
        </Card>
        <Card className="space-y-2">
          <h2 className="font-bold">Or straight in the iPhone Calendar</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>
              iPhone <strong>Settings → Apps → Calendar → Calendar Accounts → Add Account → Other</strong>.
            </li>
            <li>
              <strong>Add Subscribed Calendar</strong> → paste the link → <strong>Next → Save</strong>.
            </li>
          </ol>
        </Card>
        <Notice kind="warn">
          When you stop using the old app, turn off its Google Calendar sync so visits don&apos;t show up twice.
        </Notice>
      </Page>
    </>
  );
}
