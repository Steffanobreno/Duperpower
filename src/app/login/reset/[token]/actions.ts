"use server";
import { redirect } from "next/navigation";
import { resetPassword } from "@/lib/auth";

export type ResetState = { error?: string } | undefined;

export async function resetPasswordAction(token: string, _: ResetState, form: FormData): Promise<ResetState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 10) return { error: "Use at least 10 characters for the password." };
  if (password !== form.get("confirm")) return { error: "The two passwords are different." };
  if (!(await resetPassword(token, password))) return { error: "This link has expired or was already used." };
  redirect("/today");
}
