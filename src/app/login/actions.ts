"use server";
import { redirect } from "next/navigation";
import { createOwner, hasAnyUser, login, logout } from "@/lib/auth";

export type FormState = { error?: string } | undefined;

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!(await login(email, password))) return { error: "That email and password don't match." };
  redirect("/today");
}

export async function setupAction(_: FormState, form: FormData): Promise<FormState> {
  if (await hasAnyUser()) redirect("/login");
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email." };
  if (password.length < 10) return { error: "Use at least 10 characters for the password." };
  if (password !== form.get("confirm")) return { error: "The two passwords are different." };
  await createOwner(email, password);
  redirect("/today");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
