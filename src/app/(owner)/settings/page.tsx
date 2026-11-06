import { msg } from "@/lib/i18n";
import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { Page, PageHeader } from "@/components/ui";
import { SettingsList, type SettingsGroup } from "./settings-list";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Settings") };
}

const GROUPS: SettingsGroup[] = [
  {
    title: msg("Basic settings"),
    links: [
      { href: "/settings/account", title: msg("Account"), text: msg("Your name, login email, password, app lock (PIN) and devices") },
      { href: "/settings/business", title: msg("Business"), text: msg("Name, logo, phone, address, links and time zone") },
      { href: "/settings/hours", title: msg("Working hours"), text: msg("Days and hours you take appointments") },
      { href: "/settings/closed", title: msg("Closed dates and holidays"), text: msg("Vacations and holidays with no bookings") },
      { href: "/settings/services", title: msg("Services and prices"), text: msg("Packages, add-ons, prices and times") },
      { href: "/settings/team", title: msg("Team"), text: msg("Groomers, logins, roles, vans, pay and clock in/out") },
    ],
  },
  {
    title: msg("Clients and pets"),
    links: [
      { href: "/settings/lists", title: msg("Client and pet options"), text: msg("Tags, referral sources, pet codes, breeds, sizes, vaccines, coats") },
      { href: "/settings/import", title: msg("Import and export clients"), text: msg("Bring in your client list, or download a backup (CSV)") },
      { href: "/settings/agreement", title: msg("Service agreement"), text: msg("The terms clients sign") },
    ],
  },
  {
    title: msg("Calendar"),
    links: [
      { href: "/settings/calendar-view", title: msg("Calendar look"), text: msg("What each visit shows, hours shown and colors") },
      { href: "/settings/calendar", title: msg("Google Calendar"), text: msg("See every visit in your Google Calendar") },
    ],
  },
  {
    title: msg("Communication"),
    links: [
      { href: "/settings/messages", title: msg("Texts and email"), text: msg("Reminders, updates, receipts: each one on or off, and its text") },
      { href: "/settings/notifications", title: msg("Notifications"), text: msg("Pop-ups on your phone for new bookings, cancellations and reschedules") },
    ],
  },
  {
    title: msg("Online booking"),
    links: [
      { href: "/settings/booking", title: msg("Online booking"), text: msg("Booking page, QR code, auto-accept, distance and notice rules") },
      { href: "/settings/areas", title: msg("Service areas"), text: msg("ZIP codes and cities you serve, and which days") },
      { href: "/requests", title: msg("Booking requests"), text: msg("Accept or decline online requests") },
    ],
  },
  {
    title: msg("Safety"),
    links: [
      { href: "/settings/backups", title: msg("Backups"), text: msg("A weekly copy of everything on your Google Drive") },
    ],
  },
  {
    title: msg("Help"),
    links: [
      { href: "/help", title: msg("Help and tutorials"), text: msg("Step-by-step guides, the assistant, and a person when you need one") },
    ],
  },
];

// Without the "Change settings" permission: just their own account and phone notifications.
const MINE: SettingsGroup[] = [
  {
    title: msg("Your settings"),
    links: [
      { href: "/settings/account", title: msg("Account"), text: msg("Your name, login email, password and devices") },
      { href: "/settings/notifications", title: msg("Notifications"), text: msg("Pop-ups on your phone for new bookings, cancellations and reschedules") },
      { href: "/help", title: msg("Help and tutorials"), text: msg("Step-by-step guides, the assistant, and a person when you need one") },
    ],
  },
];

export default async function SettingsPage() {
  const { t } = await getOwnerI18n();
  const staff = await requireStaff();
  return (
    <>
      <PageHeader title={t("Settings")} />
      <Page>
        <p className="text-sm text-muted">
          {t("{businessName} · logged in as {staffName}", { businessName: staff.businessName, staffName: staff.staffName })}
        </p>
        <SettingsList groups={staff.can.settings ? GROUPS : MINE} />
      </Page>
    </>
  );
}
