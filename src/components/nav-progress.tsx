"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * A thin bar on top the moment a link inside the app is tapped, until the new screen is there:
 * the tap always shows it was heard, even when the server takes a moment.
 */
export function NavProgress() {
  const path = usePathname();
  const query = useSearchParams().toString();
  const here = `${path}?${query}`;
  // The screen the tap was on: once the screen changes (or a form's redirect lands), it's done.
  const [tappedOn, setTappedOn] = useState<string | null>(null);
  const busy = tappedOn === here;
  const setBusy = (on: boolean) => setTappedOn(on ? `${location.pathname}?${new URLSearchParams(location.search).toString()}` : null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setBusy(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Never stuck: gone after 15 seconds whatever happens.
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setBusy(false), 15_000);
    return () => clearTimeout(t);
  }, [busy]);

  if (!busy) return null;
  return (
    <div role="progressbar" aria-label="Loading" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 overflow-hidden bg-brand-soft">
      <div className="nav-progress h-full w-1/3 bg-brand" />
    </div>
  );
}
