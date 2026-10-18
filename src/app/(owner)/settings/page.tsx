import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { Button, Page, PageHeader } from "@/components/ui";
import { logoutAction } from "@/app/login/actions";

export const metadata: Metadata = { title: "Settings" };

const LINKS = [
  { href: "/settings/services", title: "Services and prices", text: "Packages, add-ons, prices and times" },
  { href: "/settings/hours", title: "Working hours", text: "Days and hours you take appointments" },
  { href: "/settings/business", title: "Business", text: "Name, phone and booking link" },
  { href: "/settings/booking", title: "Online booking", text: "Booking page link, distance and notice rules" },
  { href: "/settings/messages", title: "Texts and email", text: "iPhone texts, email, Google Calendar, message texts" },
  { href: "/requests", title: "Booking requests", text: "Accept or decline online requests" },
];

export default async function SettingsPage() {
  const staff = await requireStaff();
  return (
    <>
      <PageHeader title="Settings" />
      <Page>
        <p className="text-sm text-muted">
          {staff.businessName} · logged in as {staff.staffName}
        </p>
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
                <div className="flex-1">
                  <div className="font-semibold">{l.title}</div>
                  <div className="text-sm text-muted">{l.text}</div>
                </div>
                <span aria-hidden className="text-muted">›</span>
              </Link>
            </li>
          ))}
        </ul>
        <form action={logoutAction}>
          <Button type="submit" kind="secondary" className="w-full">Log out</Button>
        </form>
      </Page>
    </>
  );
}
