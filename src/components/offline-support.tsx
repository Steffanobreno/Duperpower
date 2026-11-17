"use client";
import { useT } from "@/components/i18n";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// Keeps the app usable in the van with a weak or no signal (see public/sw.js): turns on the
// service worker, says when the signal drops, loads the live page when the network is back
// after a saved copy, and saves the day's visits (and their code) from Today ahead of time.

type Notice = { offline: boolean; at: string | null } | null;

export function OfflineSupport() {
  const { t: tr } = useT();
  const router = useRouter();
  const path = usePathname();
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev=1").catch(() => null);
    let savedCopy = false;
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; url?: string; at?: string | null; offline?: boolean };
      if (m?.url !== location.href) return;
      if (m.type === "saved-copy") {
        savedCopy = true;
        document.getElementById("woofers-saved-copy")?.remove();
        setNotice({ offline: !!m.offline, at: m.at ?? null });
      }
      // The network caught up after a saved copy was shown: load the live page.
      if (m.type === "fresh" && (savedCopy || document.getElementById("woofers-saved-copy"))) location.reload();
    };
    const onOffline = () => setNotice((n) => n ?? { offline: true, at: null });
    const onOnline = () => {
      setNotice(null);
      if (savedCopy || document.getElementById("woofers-saved-copy")) location.reload();
      else router.refresh();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  // Back on the app after a few minutes away (phone locked, another app): wake the server and
  // the database now, while the screen is being looked at, not on the first tap.
  useEffect(() => {
    let hiddenAt = 0;
    const onVisible = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 3 * 60_000) void fetch("/api/ping", { cache: "no-store" }).catch(() => null);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // On Today, save each visit of the day for the road: only while the groomer isn't using the
  // app (each fetch keeps a server busy, and a tap shouldn't wait behind them), one at a time,
  // stopping at the first tap or key, and not again within 30 minutes for the same visits.
  useEffect(() => {
    if (path !== "/today" || !navigator.onLine || !("serviceWorker" in navigator)) return;
    const stop = new AbortController();
    const quit = () => stop.abort();
    for (const ev of ["pointerdown", "keydown", "scroll"]) window.addEventListener(ev, quit, { once: true, passive: true });
    const t = setTimeout(async () => {
      if (!navigator.serviceWorker.controller || stop.signal.aborted) return;
      const links = [...new Set([...document.querySelectorAll<HTMLAnchorElement>('a[href^="/appointments/"]')]
        .map((a) => a.getAttribute("href")!)
        .filter((h) => /^\/appointments\/[0-9a-f-]{36}$/.test(h)))].slice(0, 15);
      const key = "woofers-warmed";
      const stamp = links.join(",");
      try {
        const last = JSON.parse(localStorage.getItem(key) ?? "null") as { stamp: string; at: number } | null;
        if (last?.stamp === stamp && Date.now() - last.at < 30 * 60_000) return;
      } catch {}
      const files = new Set<string>();
      for (const href of links) {
        if (stop.signal.aborted) return;
        const res = await fetch(href, { headers: { "x-woofers-warm": "1" }, credentials: "same-origin", signal: stop.signal }).catch(() => null);
        const html = res?.ok ? await res.text().catch(() => "") : "";
        for (const m of html.matchAll(/\/_next\/static\/[^"'\s)]+/g)) files.add(m[0]);
      }
      // The screens' code too, so a saved screen also works (buttons, menus) without signal.
      for (const f of files) {
        if (stop.signal.aborted) return;
        await fetch(f, { signal: stop.signal }).catch(() => null);
      }
      try {
        localStorage.setItem(key, JSON.stringify({ stamp, at: Date.now() }));
      } catch {}
    }, 8000);
    return () => {
      clearTimeout(t);
      quit();
      for (const ev of ["pointerdown", "keydown", "scroll"]) window.removeEventListener(ev, quit);
    };
  }, [path]);

  if (!notice) return null;
  const when = notice.at ? new Date(notice.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[env(safe-area-inset-top)]">
      <p className="mt-2 rounded-full bg-navy px-4 py-1.5 text-xs font-bold text-[#f7e7a1] shadow-lg ring-1 ring-[#d4af37]">
        {notice.offline ? tr("📴 Offline") : tr("📶 Weak signal")} · {when ? tr("saved copy from {when}", { when }) : tr("showing what's saved")}
        {!notice.offline && tr(" · updating…")}
      </p>
    </div>
  );
}
