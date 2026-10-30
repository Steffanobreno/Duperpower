"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { zipInfo, zipsInCity } from "@/lib/geo/zip";
import type { FormState } from "../actions";

const COLOR = /^#[0-9a-f]{6}$/i;

/** Reads "94401, 94402 San Mateo, Burlingame" into ZIP codes: numbers as ZIPs, words as city names. */
function readZips(text: string) {
  const zips = new Set<string>();
  const unknown: string[] = [];
  for (const part of text.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean)) {
    for (const z of part.match(/\b\d{5}\b/g) ?? []) {
      if (zipInfo(z)) zips.add(z);
      else unknown.push(z);
    }
    const words = part.replace(/\b\d{5}\b/g, "").trim();
    if (words) {
      const found = zipsInCity(words);
      if (found.length) found.forEach((z) => zips.add(z));
      else unknown.push(words);
    }
  }
  return { zips: [...zips].sort(), unknown };
}

export async function saveAreaAction(id: string | null, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requirePermission("settings");
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const color = String(form.get("color") ?? "");
  const weekdays = [0, 1, 2, 3, 4, 5, 6].filter((d) => form.get(`day:${d}`) === "on");
  const { zips, unknown } = readZips(String(form.get("places") ?? ""));
  if (!name) return { error: "Give the area a name." };
  if (!COLOR.test(color)) return { error: "Pick a color." };
  if (!weekdays.length) return { error: "Pick at least one day." };
  if (unknown.length) return { error: `Not found in California: ${unknown.join(", ")}.` };
  if (!zips.length) return { error: "Add ZIP codes or city names." };
  if (id) {
    await sql`update service_areas set name = ${name}, color = ${color}, weekdays = ${weekdays}, zip_codes = ${zips}
              where id = ${id} and business_id = ${staff.businessId}`;
  } else {
    await sql`insert into service_areas (business_id, name, color, weekdays, zip_codes)
              values (${staff.businessId}, ${name}, ${color}, ${weekdays}, ${zips})`;
  }
  revalidatePath("/settings/areas");
  redirect("/settings/areas");
}

export async function deleteAreaAction(id: string) {
  const staff = await requirePermission("settings");
  await sql`delete from service_areas where id = ${id} and business_id = ${staff.businessId}`;
  revalidatePath("/settings/areas");
  redirect("/settings/areas");
}
