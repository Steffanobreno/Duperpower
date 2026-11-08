"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { checkoutUrl, paymentsMode, portalUrl } from "@/lib/billing";
import { cleanCode, codeErrorUrl, discountForCheckout } from "@/lib/discounts";
import { recordTermsAcceptance } from "@/lib/data/terms";
import { clientIp } from "@/lib/rate-limit";
import { fakeOn, fakeQuote, payFakeCheckout, setFakeCancelAtPeriodEnd } from "@/lib/fake-payments";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Opens Stripe Checkout for a plan (the owner only), with the referral or discount code typed
 * on the page, if any. In test mode, the fake checkout instead.
 */
export async function choosePlanAction(form: FormData) {
  const staff = await requireStaff();
  if (staff.role !== "owner") redirect("/billing");
  const interval = form.get("interval") === "year" ? "year" : "month";
  const code = cleanCode(form.get("code"));
  // The Terms and the automatic renewal must be accepted first: before any provider call, test mode or Stripe.
  if (form.get("accept_terms") !== "on") redirect(`/billing?terms_error=1${code ? `&code=${encodeURIComponent(code)}` : ""}`);
  const [{ user_id: userId }] = await sql<{ user_id: string | null }[]>`select user_id from staff where id = ${staff.staffId}`;
  const acceptance = { businessId: staff.businessId, userId, context: "checkout", ip: await clientIp() } as const;
  if (paymentsMode() === "fake") {
    const quote = await fakeQuote(staff.businessId, interval, code);
    if ("error" in quote) redirect(codeErrorUrl(quote.error, code));
    await recordTermsAcceptance(sql, acceptance);
    redirect(`/billing/fake-checkout?interval=${interval}${code ? `&code=${encodeURIComponent(code)}` : ""}`);
  }
  const discount = await discountForCheckout(staff.businessId, code);
  if ("error" in discount) redirect(codeErrorUrl(discount.error, code));
  await recordTermsAcceptance(sql, acceptance);
  const url = await checkoutUrl(staff.businessId, interval, appUrl(), discount).catch((e) => {
    console.error("checkout failed", e);
    return null;
  });
  redirect(url ?? "/billing?error=1");
}

/** Opens Stripe's billing portal: card, invoices, switch plans, cancel. In test mode, the fake portal. */
export async function manageBillingAction() {
  const staff = await requireStaff();
  if (staff.role !== "owner") redirect("/billing");
  if (paymentsMode() === "fake") redirect("/billing/fake-portal");
  const url = await portalUrl(staff.businessId, appUrl());
  redirect(url ?? "/billing");
}

/** Test mode's "Pay (test)": the plan starts with no real charge. */
export async function payFakeCheckoutAction(form: FormData) {
  const staff = await requireStaff();
  if (staff.role !== "owner" || !fakeOn()) redirect("/billing");
  const interval = form.get("interval") === "year" ? "year" : "month";
  const code = cleanCode(form.get("code"));
  const paid = await payFakeCheckout(staff.businessId, interval, code);
  if (typeof paid === "object") redirect(codeErrorUrl(paid.error, code));
  redirect(paid === "paid" ? "/billing?done=1" : "/billing");
}

/** Test mode's portal: Cancel at period end / Resume. */
export async function fakeCancelAtPeriodEndAction(cancel: boolean) {
  const staff = await requireStaff();
  if (staff.role !== "owner" || !fakeOn()) redirect("/billing");
  await setFakeCancelAtPeriodEnd(staff.businessId, cancel);
  revalidatePath("/billing", "layout");
  redirect("/billing/fake-portal");
}
