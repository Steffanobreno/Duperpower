"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { isUniqueViolation, sql } from "@/lib/db";
import { isOptionKind } from "@/lib/data/options";
import type { FormState } from "../actions";

const refresh = () => revalidatePath("/", "layout");

export async function addOptionAction(kind: string, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  if (!isOptionKind(kind)) return { error: "Unknown list." };
  const label = String(form.get("label") ?? "").trim().replace(/\s+/g, " ");
  if (!label || label.length > 60) return { error: "Type a name (up to 60 letters)." };
  try {
    await sql`insert into option_lists (business_id, kind, label, sort_order)
              values (${staff.businessId}, ${kind}, ${label},
                      (select coalesce(max(sort_order), 0) + 1 from option_lists where business_id = ${staff.businessId} and kind = ${kind}))`;
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `“${label}” is already on the list.` };
    throw e;
  }
  refresh();
  return { saved: true };
}

export async function renameOptionAction(id: string, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const label = String(form.get("label") ?? "").trim().replace(/\s+/g, " ");
  if (!label || label.length > 60) return { error: "Type a name (up to 60 letters)." };
  try {
    await sql.begin(async (tx) => {
      const [old] = await tx`select kind, label from option_lists where id = ${id} and business_id = ${staff.businessId}`;
      if (!old) return;
      await tx`update option_lists set label = ${label} where id = ${id}`;
      // Clients and pets keep up with the new name.
      if (old.kind === "client_tag")
        await tx`update client_tags t set label = ${label} from clients c
                 where c.id = t.client_id and c.business_id = ${staff.businessId} and t.label = ${old.label}
                   and not exists (select 1 from client_tags x where x.client_id = t.client_id and x.label = ${label})`;
      if (old.kind === "referral_source")
        await tx`update clients set referral_source = ${label} where business_id = ${staff.businessId} and referral_source = ${old.label}`;
      if (old.kind === "coat_type")
        await tx`update pets p set coat_type = ${label} from clients c
                 where c.id = p.client_id and c.business_id = ${staff.businessId} and p.coat_type = ${old.label}`;
      if (old.kind === "behavior")
        await tx`update pets p set behavior_tags = array_replace(p.behavior_tags, ${old.label}, ${label}) from clients c
                 where c.id = p.client_id and c.business_id = ${staff.businessId} and ${old.label} = any(p.behavior_tags)`;
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `“${label}” is already on the list.` };
    throw e;
  }
  refresh();
  return { saved: true };
}

export async function deleteOptionAction(id: string) {
  const staff = await requireStaff();
  await sql`delete from option_lists where id = ${id} and business_id = ${staff.businessId}`;
  refresh();
}

/** Swaps an item with its neighbor. Works for list items and pet codes. */
export async function moveOptionAction(table: "option_lists" | "pet_codes", id: string, direction: "up" | "down") {
  const staff = await requireStaff();
  await sql.begin(async (tx) => {
    const t = tx(table);
    const rows = table === "option_lists"
      ? await tx`select id, sort_order from option_lists where business_id = ${staff.businessId}
                 and kind = (select kind from option_lists where id = ${id}) order by sort_order, label`
      : await tx`select id, sort_order from pet_codes where business_id = ${staff.businessId} order by sort_order, label`;
    const i = rows.findIndex((r) => r.id === id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= rows.length) return;
    // Renumber the whole list so ties can't stop the swap.
    const order = rows.map((r) => r.id as string);
    [order[i], order[j]] = [order[j], order[i]];
    for (const [n, rid] of order.entries()) await tx`update ${t} set sort_order = ${n} where id = ${rid}`;
  });
  refresh();
}

const COLOR = /^#[0-9a-f]{6}$/i;

export async function savePetCodeAction(id: string | null, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const label = String(form.get("label") ?? "").trim();
  const description = String(form.get("description") ?? "").trim().slice(0, 120) || null;
  const color = String(form.get("color") ?? "");
  if (!label || label.length > 8) return { error: "The code needs a short name (up to 8 letters)." };
  if (!COLOR.test(color)) return { error: "Pick a color." };
  try {
    if (id) {
      await sql`update pet_codes set label = ${label}, description = ${description}, color = ${color}
                where id = ${id} and business_id = ${staff.businessId}`;
    } else {
      await sql`insert into pet_codes (business_id, label, description, color, sort_order)
                values (${staff.businessId}, ${label}, ${description}, ${color},
                        (select coalesce(max(sort_order), 0) + 1 from pet_codes where business_id = ${staff.businessId}))`;
    }
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `There is already a “${label}” code.` };
    throw e;
  }
  refresh();
  return { saved: true };
}

export async function deletePetCodeAction(id: string) {
  const staff = await requireStaff();
  await sql`delete from pet_codes where id = ${id} and business_id = ${staff.businessId}`;
  refresh();
}
