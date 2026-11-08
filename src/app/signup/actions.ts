"use server";
import { redirect } from "next/navigation";
import { signUpBusiness } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";
import { getOwnerI18n } from "@/lib/i18n/server";
import { isLang, type Lang } from "@/lib/i18n";
import { regionOf } from "@/lib/region";
import { currencyOf, isCountry, isZone, mainZoneOf } from "@/lib/countries";
import { tooManyFromHere } from "@/lib/rate-limit";
import { recordReferral } from "@/lib/discounts";
import { sql } from "@/lib/db";

export type SignupState = { error?: string } | undefined;

// A groomer creates their business account (from the sales page): business, owner login,
// starter services and messages; then straight into the app.
export async function signupAction(_: SignupState, form: FormData): Promise<SignupState> {
  if (process.env.SIGNUPS === "off") return { error: "New accounts are paused right now. Please try again later." };
  if (String(form.get("website") ?? "")) return { error: "Please try again." }; // a bot filled the hidden field
  const businessName = String(form.get("business") ?? "").trim().slice(0, 80);
  const ownerName = String(form.get("name") ?? "").trim().slice(0, 60);
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const zip = String(form.get("zip") ?? "").trim().slice(0, 10) || null;
  const country = isCountry(form.get("country")) ? String(form.get("country")) : "US";
  const tz = String(form.get("timezone") ?? "");
  const timezone = isZone(tz) ? tz : mainZoneOf(country);
  if (businessName.length < 2) return { error: "Type your business name." };
  // A few accounts an hour from one place is plenty for real people (a shared office, a retry).
  if (await tooManyFromHere("signup", 5, 3600_000)) return { error: "New accounts are paused right now. Please try again later." };
  if (!ownerName) return { error: "Type your name." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email." };
  if (password.length < 10) return { error: "Use at least 10 characters for the password." };
  if (form.get("terms") !== "on") return { error: "Please accept the terms to create your account." };
  const error = await signUpBusiness({ businessName, ownerName, email, password, phone: normalizePhone(form.get("phone"), country), zip, timezone, country, currency: currencyOf(country),
    lang: isLang(form.get("lang")) ? (form.get("lang") as Lang) : (await getOwnerI18n()).lang, metric: regionOf(country).metric,
    source: String(form.get("source") ?? "").trim().slice(0, 120) || null });
  if (error) return { error };
  // Came with a referral link (/signup?ref=<code>): the new business is noted as referred.
  const source = String(form.get("source") ?? "").trim();
  // "<code>", or "<code> / <utm_source>" from a Fino footer link: the code is the first part.
  const code = source.split(" / ")[0];
  if (code && !code.includes(" ")) {
    const [biz] = await sql<{ id: string }[]>`
      select s.business_id as id from staff s join users u on u.id = s.user_id
      where u.email = ${email.toLowerCase()} and s.role = 'owner' order by s.created_at desc limit 1`;
    if (biz) await recordReferral(biz.id, code).catch((e) => console.error("referral not recorded", e));
  }
  redirect("/welcome");
}
