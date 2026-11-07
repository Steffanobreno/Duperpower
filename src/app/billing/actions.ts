"use server";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { checkoutUrl, portalUrl } from "@/lib/billing";
import { cleanCode, discountForCheckout } from "@/lib/discounts";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Opens Stripe Checkout for a plan (the owner only), with the referral or discount code typed
 * on the page, if any.
 */
export async function choosePlanAction(form: FormData) {
  const staff = await requireStaff();
  if (staff.role !== "owner") redirect("/billing");
  const interval = form.get("interval") === "year" ? "year" : "month";
  const code = cleanCode(form.get("code"));
  const discount = await discountForCheckout(staff.businessId, code);
  if ("error" in discount) {
    const why = discount.error.startsWith("That's your own") ? "own" : "bad";
    redirect(`/billing?code_error=${why}&code=${encodeURIComponent(code)}`);
  }
  const url = await checkoutUrl(staff.businessId, interval, appUrl(), discount).catch((e) => {
    console.error("checkout failed", e);
    return null;
  });
  redirect(url ?? "/billing?error=1");
}

/** Opens Stripe's billing portal: card, invoices, switch plans, cancel. */
export async function manageBillingAction() {
  const staff = await requireStaff();
  if (staff.role !== "owner") redirect("/billing");
  const url = await portalUrl(staff.businessId, appUrl());
  redirect(url ?? "/billing");
}
