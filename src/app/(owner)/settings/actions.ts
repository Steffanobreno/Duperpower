"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { isUniqueViolation, sql } from "@/lib/db";
import { normalizePhone, parseMoney, SIZES } from "@/lib/format";

export type FormState = { error?: string; saved?: boolean } | undefined;

export async function saveServiceAction(serviceId: string | null, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const name = String(form.get("name") ?? "").trim();
  const kind = form.get("kind") === "addon" ? "addon" : "service";
  const category = String(form.get("category") ?? "").trim() || (kind === "addon" ? "Add-on" : null);
  const size = String(form.get("size_class") ?? "");
  const size_class = SIZES.some((s) => s.value === size) ? size : null;
  const duration = Number(form.get("duration_min"));
  const price = parseMoney(form.get("price"));
  const description = String(form.get("description") ?? "").trim() || null;
  const active = form.get("active") === "on";
  const online = form.get("online_bookable") === "on";
  if (!name) return { error: "Give the service a name." };
  if (!Number.isInteger(duration) || duration < 0 || duration > 600) return { error: "Duration must be 0 to 600 minutes." };
  if (price === null) return { error: "Enter a price, like 129 or 129.00." };

  if (serviceId) {
    await sql`
      update services set name = ${name}, kind = ${kind}, category = ${category}, size_class = ${size_class},
        duration_min = ${duration}, price_cents = ${price}, description = ${description},
        active = ${active}, online_bookable = ${online}
      where id = ${serviceId} and business_id = ${staff.businessId}`;
  } else {
    await sql`
      insert into services (business_id, name, kind, category, size_class, duration_min, price_cents, description,
                            active, online_bookable, sort_order)
      values (${staff.businessId}, ${name}, ${kind}, ${category}, ${size_class}, ${duration}, ${price}, ${description},
              ${active}, ${online},
              (select coalesce(max(sort_order), 0) + 1 from services where business_id = ${staff.businessId}))`;
  }
  revalidatePath("/settings/services");
  redirect("/settings/services");
}

export async function moveServiceAction(serviceId: string, direction: "up" | "down") {
  const staff = await requireStaff();
  // Swap sort_order with the neighbor in the same kind and category.
  await sql.begin(async (tx) => {
    const [me] = await tx`select id, kind, category, sort_order from services
                          where id = ${serviceId} and business_id = ${staff.businessId}`;
    if (!me) return;
    const [other] = direction === "up"
      ? await tx`select id, sort_order from services where business_id = ${staff.businessId} and kind = ${me.kind}
                 and category is not distinct from ${me.category} and sort_order < ${me.sort_order}
                 order by sort_order desc limit 1`
      : await tx`select id, sort_order from services where business_id = ${staff.businessId} and kind = ${me.kind}
                 and category is not distinct from ${me.category} and sort_order > ${me.sort_order}
                 order by sort_order limit 1`;
    if (!other) return;
    await tx`update services set sort_order = ${other.sort_order} where id = ${me.id}`;
    await tx`update services set sort_order = ${me.sort_order} where id = ${other.id}`;
  });
  revalidatePath("/settings/services");
}

export async function saveHoursAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const rows: { weekday: number; start: string; end: string }[] = [];
  for (let d = 0; d < 7; d++) {
    if (form.get(`open:${d}`) !== "on") continue;
    const start = String(form.get(`start:${d}`) ?? "");
    const end = String(form.get(`end:${d}`) ?? "");
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || end <= start)
      return { error: "Each open day needs a start time before its end time." };
    rows.push({ weekday: d, start, end });
  }
  await sql.begin(async (tx) => {
    await tx`delete from working_hours where staff_id = ${staff.staffId}`;
    for (const r of rows) {
      await tx`insert into working_hours (staff_id, weekday, start_time, end_time)
               values (${staff.staffId}, ${r.weekday}, ${r.start}, ${r.end})`;
    }
  });
  revalidatePath("/settings/hours");
  revalidatePath("/calendar");
  return { saved: true };
}

export async function saveBusinessAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const name = String(form.get("name") ?? "").trim();
  const rawPhone = String(form.get("phone") ?? "").trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  const slug = String(form.get("booking_slug") ?? "").trim().toLowerCase();
  const ownerName = String(form.get("owner_name") ?? "").trim();
  if (!name) return { error: "The business needs a name." };
  if (rawPhone && !phone) return { error: "Enter a 10-digit US phone number." };
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return { error: "The booking link can use letters, numbers and dashes (3 to 40)." };
  try {
    await sql.begin(async (tx) => {
      await tx`update businesses set name = ${name}, phone = ${phone}, booking_slug = ${slug} where id = ${staff.businessId}`;
      if (ownerName) await tx`update staff set name = ${ownerName} where id = ${staff.staffId}`;
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "That booking link is taken." };
    throw e;
  }
  revalidatePath("/settings");
  return { saved: true };
}
