"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useT } from "./i18n";

// The header's back arrow. It goes back in the browser history when the previous screen is
// part of the app, and to the page's fixed fallback when there is none (a fresh load, a shared
// link), so it never leaves the app.
//
// How "the previous screen is in the app" is known: <NavDepth /> (mounted once in the owner
// layout) counts, in sessionStorage, the history entries the app pushed in this tab. Going back (this button, or the browser/Android back
// gesture, both fire `popstate`) never adds: the button takes 1 off and flags the move, and
// the popstate handler clears the flag (and takes 1 off for a gesture the button did not start).
// Pushes are counted by wrapping history.pushState, so replace navigations count 0.

const DEPTH = "fino:navDepth";
const GOING_BACK = "fino:navBack";

function read(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null) {
  try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value); } catch { /* storage blocked: no history, fall back */ }
}
function depth(): number {
  const n = Number(read(DEPTH));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  const { t } = useT();
  return (
    <button type="button" aria-label={t("Back")} className="-ml-2 rounded-lg p-2 text-white hover:bg-white/10"
      onClick={() => {
        const d = depth();
        if (d > 0) {
          write(DEPTH, String(d - 1));
          write(GOING_BACK, "1");
          // If no popstate follows (nothing to go back to), don't leave the flag armed.
          setTimeout(() => write(GOING_BACK, null), 2000);
          router.back();
        } else {
          router.push(fallback);
        }
      }}>
      <span aria-hidden>←</span>
    </button>
  );
}

/** Counts in-app navigations for BackButton. Renders nothing. */
export function NavDepth() {
  useEffect(() => {
    // A fresh document entry (typed URL, link from outside) has no in-app history behind it. A reload or a
    // back/forward into this document keeps the count.
    try {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (nav?.type === "navigate") write(DEPTH, "0");
    } catch { /* no timing API: keep what we have */ }

    // The App Router pushes a history entry with history.pushState and replaces with replaceState
    // (next/dist/client/components/app-router.js, the commit effect), so counting pushes counts real
    // forward navigations; replace-style navigations (redirects, router.replace) count 0.
    const h = window.history as History & { __finoWrapped?: boolean };
    if (!h.__finoWrapped) {
      h.__finoWrapped = true;
      const push = h.pushState.bind(h);
      h.pushState = (...args: Parameters<History["pushState"]>) => {
        push(...args);
        write(DEPTH, String(depth() + 1));
      };
    }

    const onPop = () => {
      // The button already took 1 off and flagged it; a browser/Android back gesture did not.
      if (read(GOING_BACK)) write(GOING_BACK, null);
      else write(DEPTH, String(Math.max(0, depth() - 1)));
    };
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("popstate", onPop) };
  }, []);

  return null;
}
