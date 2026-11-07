"use server";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { checkoutUrl, portalUrl, type Interval } from "@/lib/billing";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Opens Stripe Checkout for a plan (the owner only). */
export async function choosePlanAction(interval: Interval) {
  const staff = await requireStaff();
  if (staff.role !== "owner") redirect("/billing");
  const url = await checkoutUrl(staff.businessId, interval === "year" ? "year" : "month", appUrl());
  redirect(url ?? "/billing?error=1");
}

/** Opens Stripe's billing portal: card, invoices, switch plans, cancel. */
export async function manageBillingAction() {
  const staff = await requireStaff();
  if (staff.role !== "owner") redirect("/billing");
  const url = await portalUrl(staff.businessId, appUrl());
  redirect(url ?? "/billing");
}
