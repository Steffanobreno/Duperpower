// What a team member may do. The owner may do everything; admins and groomers get what the
// owner allows in Settings → Team → Roles.

export const PERMISSIONS = {
  all_appointments: { title: "See and manage every groomer's visits", hint: "Off: only their own visits and route." },
  payments: { title: "Take payments and finish orders", hint: "Collect payment, change prices at checkout, receipts." },
  client_contact: { title: "See client phone numbers and emails", hint: "Off: they can still call and text from a visit." },
  delete: { title: "Delete clients, pets and visits", hint: "" },
  reports: { title: "See reports, money totals and payroll", hint: "" },
  marketing: { title: "Send marketing emails", hint: "" },
  settings: { title: "Change settings", hint: "Services, prices, hours, messages, online booking, team." },
} as const;
export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const ROLES = {
  owner: "Owner",
  admin: "Admin",
  groomer: "Groomer",
} as const;
export type Role = keyof typeof ROLES;

/** What each role starts with. */
export const DEFAULT_PERMISSIONS: Record<"admin" | "groomer", Permission[]> = {
  admin: ["all_appointments", "payments", "client_contact", "delete", "reports", "marketing", "settings"],
  groomer: ["payments", "client_contact"],
};
