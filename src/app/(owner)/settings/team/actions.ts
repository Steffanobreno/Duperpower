"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { removeStaffLogin, requirePermission, setStaffLogin } from "@/lib/auth";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import { sql } from "@/lib/db";
import { isYmd, normalizePhone, parseMoney, zonedToUtc } from "@/lib/format";
import { GROOMER_COLORS } from "@/lib/data/staff";

export type TeamState = { error?: string; saved?: boolean } | undefined;

function read(form: FormData) {
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const color = String(form.get("color") ?? "");
  const phoneRaw = String(form.get("phone") ?? "").trim();
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  const email = String(form.get("email") ?? "").trim().toLowerCase() || null;
  if (!name) return { error: "Type the groomer's name." };
  if (!GROOMER_COLORS.includes(color)) return { error: "Pick a color." };
  if (phoneRaw && !phone) return { error: "Check the phone number (10 digits)." };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Check the email address." };
  return { name, color, phone, email };
}

export async function addGroomerAction(_: TeamState, form: FormData): Promise<TeamState> {
  const staff = await requirePermission("settings");
  const g = read(form);
  if ("error" in g) return { error: g.error };
  await sql.begin(async (tx) => {
    const [row] = await tx`
      insert into staff (business_id, name, role, color, phone, email)
      values (${staff.businessId}, ${g.name}, 'groomer', ${g.color}, ${g.phone}, ${g.email}) returning id`;
    // Start with the owner's working hours; they can be changed later.
    await tx`insert into working_hours (staff_id, weekday, start_time, end_time)
             select ${row.id}, weekday, start_time, end_time from working_hours where staff_id = ${staff.staffId}`;
  });
  revalidatePath("/settings/team");
  return { saved: true };
}

export async function updateGroomerAction(id: string, _: TeamState, form: FormData): Promise<TeamState> {
  const staff = await requirePermission("settings");
  const g = read(form);
  if ("error" in g) return { error: g.error };
  const [row] = await sql`select role from staff where id = ${id} and business_id = ${staff.businessId}`;
  if (!row) return { error: "Groomer not found." };
  const active = row.role === "owner" || form.get("active") === "on";
  await sql`update staff set name = ${g.name}, color = ${g.color}, phone = ${g.phone}, email = ${g.email}, active = ${active}
            where id = ${id} and business_id = ${staff.businessId}`;
  revalidatePath("/settings/team");
  revalidatePath("/calendar");
  redirect("/settings/team");
}

export async function saveRoleAction(id: string, _: TeamState, form: FormData): Promise<TeamState> {
  const staff = await requirePermission("settings");
  const role = String(form.get("role"));
  if (role !== "admin" && role !== "groomer") return { error: "Pick a role." };
  await sql`update staff set role = ${role} where id = ${id} and business_id = ${staff.businessId} and role <> 'owner'`;
  revalidatePath(`/settings/team/${id}`);
  return { saved: true };
}

export async function saveLoginAction(id: string, _: TeamState, form: FormData): Promise<TeamState> {
  const staff = await requirePermission("settings");
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter the email they will log in with." };
  if (password.length < 10) return { error: "Use at least 10 characters for the password." };
  const [target] = await sql`select role from staff where id = ${id} and business_id = ${staff.businessId}`;
  if (!target || target.role === "owner") return { error: "The owner changes their login in Account." };
  if (!(await setStaffLogin(staff.businessId, id, email, password))) return { error: "Another login already uses that email." };
  revalidatePath(`/settings/team/${id}`);
  return { saved: true };
}

export async function removeLoginAction(id: string) {
  const staff = await requirePermission("settings");
  await removeStaffLogin(staff.businessId, id);
  revalidatePath(`/settings/team/${id}`);
}

export async function savePayAction(id: string, _: TeamState, form: FormData): Promise<TeamState> {
  const staff = await requirePermission("settings");
  const pct = (k: string) => Number(String(form.get(k) ?? "").trim() || 0);
  const commission = pct("commission_pct");
  const tips = pct("tips_pct");
  const hourly = parseMoney(form.get("hourly") || "0");
  if (![commission, tips].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) return { error: "Percentages go from 0 to 100." };
  if (hourly === null) return { error: "Enter the hourly pay, like 20 or 22.50." };
  await sql`update staff set commission_pct = ${commission}, tips_pct = ${tips}, hourly_cents = ${hourly}
            where id = ${id} and business_id = ${staff.businessId}`;
  revalidatePath(`/settings/team/${id}`);
  return { saved: true };
}

export async function saveRolePermissionsAction(role: "admin" | "groomer", _: TeamState, form: FormData): Promise<TeamState> {
  const staff = await requirePermission("settings");
  const perms = ALL_PERMISSIONS.filter((p) => form.get(p) === "on");
  await sql.begin(async (tx) => {
    await tx`delete from role_permissions where business_id = ${staff.businessId} and role = ${role}`;
    for (const p of perms) await tx`insert into role_permissions (business_id, role, perm) values (${staff.businessId}, ${role}, ${p})`;
  });
  revalidatePath("/settings/team/roles");
  return { saved: true };
}

export async function setClockEnabledAction(on: boolean) {
  const staff = await requirePermission("settings");
  await sql`update businesses set clock_enabled = ${on} where id = ${staff.businessId}`;
  revalidatePath("/settings/team/clock");
  revalidatePath("/today");
}

export async function saveClockEntryAction(id: string, _: TeamState, form: FormData): Promise<TeamState> {
  const staff = await requirePermission("settings");
  const date = String(form.get("date") ?? "");
  const inT = String(form.get("in") ?? "");
  const outT = String(form.get("out") ?? "");
  if (!isYmd(date) || !/^\d{2}:\d{2}$/.test(inT)) return { error: "Pick the day and the time in." };
  if (outT && outT <= inT) return { error: "Clock out must be after clock in." };
  const inAt = zonedToUtc(date, inT, staff.timezone);
  const outAt = outT ? zonedToUtc(date, outT, staff.timezone) : null;
  await sql`update clock_entries e set in_at = ${inAt}, out_at = ${outAt}
            from staff s where s.id = e.staff_id and s.business_id = ${staff.businessId} and e.id = ${id}`;
  revalidatePath("/settings/team/clock");
  return { saved: true };
}

export async function deleteClockEntryAction(id: string) {
  const staff = await requirePermission("settings");
  await sql`delete from clock_entries e using staff s where s.id = e.staff_id and s.business_id = ${staff.businessId} and e.id = ${id}`;
  revalidatePath("/settings/team/clock");
}
