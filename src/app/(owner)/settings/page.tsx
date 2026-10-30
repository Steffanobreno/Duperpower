import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { Page, PageHeader } from "@/components/ui";
import { SettingsList, type SettingsGroup } from "./settings-list";

export const metadata: Metadata = { title: "Settings" };

const GROUPS: SettingsGroup[] = [
  {
    title: "Basic settings",
    links: [
      { href: "/settings/account", title: "Account", text: "Your name, login email, password, app lock (PIN) and devices" },
      { href: "/settings/business", title: "Business", text: "Name, logo, phone, address, links and time zone" },
      { href: "/settings/hours", title: "Working hours", text: "Days and hours you take appointments" },
      { href: "/settings/closed", title: "Closed dates and holidays", text: "Vacations and holidays with no bookings" },
      { href: "/settings/services", title: "Services and prices", text: "Packages, add-ons, prices and times" },
      { href: "/settings/team", title: "Team", text: "Groomers, logins, roles, vans, pay and clock in/out" },
    ],
  },
  {
    title: "Clients and pets",
    links: [
      { href: "/settings/lists", title: "Client and pet options", text: "Tags, referral sources, pet codes, breeds, sizes, vaccines, coats" },
      { href: "/settings/import", title: "Import and export clients", text: "Bring in your client list, or download a backup (CSV)" },
      { href: "/settings/agreement", title: "Service agreement", text: "The terms clients sign" },
    ],
  },
  {
    title: "Calendar",
    links: [
      { href: "/settings/calendar-view", title: "Calendar look", text: "What each visit shows, hours shown and colors" },
      { href: "/settings/calendar", title: "Google Calendar", text: "See every visit in your Google Calendar" },
    ],
  },
  {
    title: "Communication",
    links: [
      { href: "/settings/messages", title: "Texts and email", text: "Reminders, updates, receipts: each one on or off, and its text" },
      { href: "/settings/notifications", title: "Notifications", text: "Pop-ups on your phone for new bookings, cancellations and reschedules" },
    ],
  },
  {
    title: "Online booking",
    links: [
      { href: "/settings/booking", title: "Online booking", text: "Booking page, QR code, auto-accept, distance and notice rules" },
      { href: "/settings/areas", title: "Service areas", text: "ZIP codes and cities you serve, and which days" },
      { href: "/requests", title: "Booking requests", text: "Accept or decline online requests" },
    ],
  },
  {
    title: "Safety",
    links: [
      { href: "/settings/backups", title: "Backups", text: "A weekly copy of everything on your Google Drive" },
    ],
  },
];

// Without the "Change settings" permission: just their own account and phone notifications.
const MINE: SettingsGroup[] = [
  {
    title: "Your settings",
    links: [
      { href: "/settings/account", title: "Account", text: "Your name, login email, password and devices" },
      { href: "/settings/notifications", title: "Notifications", text: "Pop-ups on your phone for new bookings, cancellations and reschedules" },
    ],
  },
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
        <SettingsList groups={staff.can.settings ? GROUPS : MINE} />
      </Page>
    </>
  );
}
