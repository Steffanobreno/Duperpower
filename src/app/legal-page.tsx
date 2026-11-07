import type { ReactNode } from "react";
import { SiteFooter, SiteNav } from "./site-chrome";
import { siteChrome } from "./site-copy";

/** A plain, readable legal page in the sales page's light style. */
export function LegalPage({ title, updated, path, children }: { title: string; updated: string; path: string; children: ReactNode }) {
  return (
    <div lang="en" className="min-h-full bg-white text-black" style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <SiteNav c={siteChrome("en")} lang="en" />
      <main className="mx-auto max-w-[720px] px-4 py-12">
        <h1 className="text-[40px] font-bold leading-none tracking-[-0.025em]">{title}</h1>
        <p className="mt-3 text-[13px] text-[#737373]">Last updated: {updated}</p>
        <div className="mt-8 space-y-5 text-[16px] leading-[1.6] text-[#333] [&_h2]:pt-4 [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:text-black [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
          {children}
        </div>
      </main>
      <SiteFooter c={siteChrome("en")} lang="en" path={path} />
    </div>
  );
}
