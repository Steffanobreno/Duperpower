"use server";
import { redirect } from "next/navigation";
import { signUpBusiness } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";
import { TIMEZONES } from "@/lib/timezones";

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
  const tz = String(form.get("timezone") ?? "");
  const timezone = TIMEZONES.some(([v]) => v === tz) ? tz : "America/Los_Angeles";
  if (businessName.length < 2) return { error: "Type your business name." };
  if (!ownerName) return { error: "Type your name." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email." };
  if (password.length < 10) return { error: "Use at least 10 characters for the password." };
  if (form.get("terms") !== "on") return { error: "Please accept the terms to create your account." };
  const error = await signUpBusiness({ businessName, ownerName, email, password, phone: normalizePhone(form.get("phone")), zip, timezone });
  if (error) return { error };
  redirect("/today?welcome=1");
}
