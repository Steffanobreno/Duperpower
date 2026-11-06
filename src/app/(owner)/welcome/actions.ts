"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { normalizePhone, parseMoney } from "@/lib/format";
import { msg } from "@/lib/i18n";
import { postalOk } from "@/lib/region";
import { saveHoursAction } from "../settings/actions";

export type WelcomeState = { error?: string } | undefined;

/** Step 1: how clients reach the business (the logo saves on its own). */
export async function welcomeBusinessAction(_: WelcomeState, form: FormData): Promise<WelcomeState> {
  const staff = await requirePermission("settings");
  const text = (k: string, max = 200) => String(form.get(k) ?? "").trim().slice(0, max) || null;
  const rawPhone = text("phone", 40);
  const phone = rawPhone ? normalizePhone(rawPhone, staff.region.country) : null;
  const zip = text("zip", 10);
  if (rawPhone && !phone) return { error: msg("Check the phone number.") };
  if (zip && !postalOk(zip, staff.region.country)) return { error: msg("Check the postal code.") };
  await sql`update businesses set phone = coalesce(${phone}, phone), address_line = coalesce(${text("address_line")}, address_line),
              city = coalesce(${text("city", 60)}, city), zip = coalesce(${zip}, zip), start_zip = coalesce(start_zip, ${zip})
            where id = ${staff.businessId}`;
  revalidatePath("/", "layout");
  redirect("/welcome?step=2");
}

/** Step 2: the price of each service, and which add-ons are offered. */
export async function welcomePricesAction(_: WelcomeState, form: FormData): Promise<WelcomeState> {
  const staff = await requirePermission("settings");
  const services = await sql<{ id: string; kind: string }[]>`
    select id, kind from services where business_id = ${staff.businessId}`;
  const updates: { id: string; cents: number; active: boolean }[] = [];
  for (const s of services) {
    if (!form.has(`price:${s.id}`)) continue;
    const cents = parseMoney(form.get(`price:${s.id}`));
    if (cents == null || cents > 10_000_000) return { error: msg("Check the prices.") };
    updates.push({ id: s.id, cents, active: s.kind === "addon" ? form.get(`on:${s.id}`) === "on" : true });
  }
  await sql.begin(async (tx) => {
    for (const u of updates) {
      await tx`update services set price_cents = ${u.cents}, active = ${u.active}, updated_at = now()
               where id = ${u.id} and business_id = ${staff.businessId}`;
    }
  });
  revalidatePath("/settings/services");
  redirect("/welcome?step=3");
}

/** Step 3: working hours, then on to the clients. */
export async function welcomeHoursAction(state: WelcomeState, form: FormData): Promise<WelcomeState> {
  const done = await saveHoursAction(state, form);
  if (done && "error" in done && done.error) return { error: done.error };
  redirect("/welcome?step=4");
}

/** Last step, or "skip setup": the app opens on Today from now on. */
export async function finishWelcomeAction() {
  const staff = await requirePermission("settings");
  await sql`update businesses set onboarded_at = coalesce(onboarded_at, now()) where id = ${staff.businessId}`;
  redirect("/today?welcome=1");
}
