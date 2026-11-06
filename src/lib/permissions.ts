// What a team member may do. The owner may do everything; admins and groomers get what the
// owner allows in Settings → Team → Roles.
import { msg } from "@/lib/i18n";

export const PERMISSIONS = {
  all_appointments: { title: msg("See and manage every groomer's visits"), hint: msg("Off: only their own visits and route.") },
  payments: { title: msg("Take payments and finish orders"), hint: msg("Collect payment, change prices at checkout, receipts.") },
  client_contact: { title: msg("See client phone numbers and emails"), hint: msg("Off: they can still call and text from a visit.") },
  delete: { title: msg("Delete clients, pets and visits"), hint: "" },
  reports: { title: msg("See reports, money totals and payroll"), hint: "" },
  marketing: { title: msg("Send marketing emails"), hint: "" },
  settings: { title: msg("Change settings"), hint: msg("Services, prices, hours, messages, online booking, team.") },
} as const;
export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const ROLES = {
  owner: msg("Owner"),
  admin: msg("Admin"),
  groomer: msg("Groomer"),
} as const;
export type Role = keyof typeof ROLES;

/** What each role starts with. */
export const DEFAULT_PERMISSIONS: Record<"admin" | "groomer", Permission[]> = {
  admin: ["all_appointments", "payments", "client_contact", "delete", "reports", "marketing", "settings"],
  groomer: ["payments", "client_contact"],
};
