import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/product";

/** A plain, readable legal page in the sales page's light style. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-full bg-white text-black" style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <header className="px-4 pt-6">
        <Link href="/" className="text-[15px] font-bold">← {APP_NAME}</Link>
      </header>
      <main className="mx-auto max-w-[720px] px-4 py-12">
        <h1 className="text-[40px] font-bold leading-none tracking-[-0.025em]">{title}</h1>
        <p className="mt-3 text-[13px] text-[#737373]">Last updated: {updated}</p>
        <div className="mt-8 space-y-5 text-[16px] leading-[1.6] text-[#333] [&_h2]:pt-4 [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:text-black [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
          {children}
        </div>
      </main>
    </div>
  );
}
