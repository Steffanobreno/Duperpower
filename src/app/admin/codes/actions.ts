"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { billingOn } from "@/lib/billing";
import { sql } from "@/lib/db";
import { cleanCode, createDiscountCode, deactivateDiscountCode } from "@/lib/discounts";
import { isUuid } from "@/lib/format";

export type CodeState = { error?: string; saved?: boolean } | undefined;

/** A new discount code (a Stripe coupon with a promotion code that groomers type). */
export async function createCodeAction(_: CodeState, form: FormData): Promise<CodeState> {
  await requireAdmin();
  if (!billingOn()) return { error: "O Stripe ainda não está configurado (STRIPE_SECRET_KEY)." };
  const code = cleanCode(form.get("code"));
  if (!/^[A-Z0-9][A-Z0-9-]{2,29}$/.test(code)) return { error: "O código precisa de 3 a 30 letras, números ou hífen." };
  // The referral codes look like "NAME-1234": discount codes must not, or they'd be mistaken.
  if (/^[A-Z]+-\d{4}$/.test(code)) return { error: "Esse formato (LETRAS-1234) é dos códigos de indicação. Escolha outro." };
  const [taken] = await sql`select 1 from discount_codes where code = ${code} union select 1 from businesses where referral_code = ${code}`;
  if (taken) return { error: "Esse código já existe." };
  const kind = form.get("kind") === "amount" ? "amount" : "percent";
  const value = Number(String(form.get("value") ?? "").replace(",", "."));
  if (!(value > 0) || (kind === "percent" && value > 100) || (kind === "amount" && value > 290)) {
    return { error: kind === "percent" ? "Desconto de 1% a 100%." : "Desconto de US$1 a US$290." };
  }
  const duration = form.get("duration") === "forever" ? "forever" : form.get("duration") === "repeating" ? "repeating" : "once";
  const months = Math.round(Number(form.get("months") ?? 0));
  if (duration === "repeating" && !(months >= 1 && months <= 36)) return { error: "Quantos meses? (1 a 36)" };
  const max = form.get("max") ? Math.round(Number(form.get("max"))) : null;
  if (max != null && !(max >= 1)) return { error: "Limite de usos: 1 ou mais (ou deixe vazio)." };
  const expiresRaw = String(form.get("expires") ?? "");
  const expiresAt = expiresRaw ? new Date(`${expiresRaw}T23:59:59Z`) : null;
  if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now())) return { error: "A validade precisa ser uma data futura." };
  try {
    await createDiscountCode({
      code, percentOff: kind === "percent" ? value : null, amountOffCents: kind === "amount" ? Math.round(value * 100) : null,
      duration, durationMonths: duration === "repeating" ? months : null, maxRedemptions: max, expiresAt,
      note: String(form.get("note") ?? "").trim().slice(0, 200) || null,
    });
  } catch (e) {
    console.error("discount code", e);
    return { error: `O Stripe recusou: ${(e as Error).message}`.slice(0, 300) };
  }
  revalidatePath("/admin/codes");
  return { saved: true };
}

export async function deactivateCodeAction(id: string) {
  await requireAdmin();
  if (isUuid(id)) await deactivateDiscountCode(id);
  revalidatePath("/admin/codes");
  redirect("/admin/codes");
}
