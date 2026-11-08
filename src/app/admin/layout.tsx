import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { paymentsMode } from "@/lib/billing";
import { TestModeBanner } from "@/components/test-mode-banner";
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
          <nav aria-label="Painel" className="flex flex-wrap gap-1 text-sm font-semibold">
            <Link href="/admin" className="rounded-lg px-3 py-1.5 hover:bg-white/10">Visão geral</Link>
            <Link href="/admin/businesses" className="rounded-lg px-3 py-1.5 hover:bg-white/10">Negócios</Link>
            <Link href="/admin/codes" className="rounded-lg px-3 py-1.5 hover:bg-white/10">Códigos</Link>
            <Link href="/admin/help" className="rounded-lg px-3 py-1.5 hover:bg-white/10">Suporte</Link>
            <Link href="/admin/errors" className="rounded-lg px-3 py-1.5 hover:bg-white/10">Erros</Link>
          </nav>
          <span className="ml-auto hidden text-xs text-white/70 sm:inline">{me.email}</span>
          <Link href="/today" className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold">Voltar ao app</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
        {paymentsMode() === "fake" && (
          <TestModeBanner>Modo de teste — nenhuma cobrança real. Os planos são “pagos” numa página de teste, sem Stripe.</TestModeBanner>
        )}
        {children}
      </main>
    </div>
  );
}
