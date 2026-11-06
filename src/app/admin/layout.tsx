import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { APP_NAME } from "@/lib/product";

export const metadata: Metadata = { title: `Painel · ${APP_NAME}`, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// The app owner's own dashboard (not the groomers'): every business on the app. In Portuguese,
// for the owner only; ADMIN_EMAILS in the server settings decides who gets in.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  return (
    <div lang="pt" className="min-h-full bg-bg">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <p className="font-extrabold">{APP_NAME} · Painel</p>
          <nav aria-label="Painel" className="flex gap-1 text-sm font-semibold">
            <Link href="/admin" className="rounded-lg px-3 py-1.5 hover:bg-white/10">Visão geral</Link>
            <Link href="/admin/businesses" className="rounded-lg px-3 py-1.5 hover:bg-white/10">Negócios</Link>
            <Link href="/admin/help" className="rounded-lg px-3 py-1.5 hover:bg-white/10">Suporte</Link>
          </nav>
          <span className="ml-auto hidden text-xs text-white/70 sm:inline">{me.email}</span>
          <Link href="/today" className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold">Voltar ao app</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">{children}</main>
    </div>
  );
}
