import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaff, hasAnyUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  if (!(await hasAnyUser())) redirect("/setup");
  if (await getStaff()) redirect("/today");
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">Woofers Dog Spa</h1>
      <p className="mb-6 text-muted">Log in to see your day.</p>
      <Card>
        <LoginForm mode="login" />
      </Card>
    </main>
  );
}
