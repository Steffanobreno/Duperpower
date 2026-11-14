"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useT } from "./i18n";

// The header's back arrow. It goes back in the browser history when the previous screen is
// part of the app, and to the page's fixed fallback when there is none (a fresh load, a shared
// link), so it never leaves the app.
//
// How "the previous screen is in the app" is known: <NavDepth /> (mounted once in the owner
// layout) counts, in sessionStorage, how many in-app navigations happened since this tab loaded
// the app. Forward navigations add 1. Going back (this button, or the browser/Android back
// gesture, both fire `popstate`) never adds: the button takes 1 off and flags the move, and
// the popstate handler skips the pathname change that follows it (and takes 1 off for a
// gesture the button did not start). So the count can return to 0.

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
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  const skip = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onPop = () => {
      if (read(GOING_BACK)) write(GOING_BACK, null);
      else write(DEPTH, String(Math.max(0, depth() - 1)));
      skip.current = true;
      // A history move that keeps the same pathname never reaches the effect below: don't leave the skip armed.
      clearTimeout(timer);
      timer = setTimeout(() => { skip.current = false; }, 2000);
    };
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("popstate", onPop); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    // Compare with the last pathname seen: the first render (and React's dev double-run of effects) has no change.
    const changed = last.current !== null && last.current !== pathname;
    last.current = pathname;
    if (!changed) return;
    if (skip.current) { skip.current = false; return; }
    write(DEPTH, String(depth() + 1));
  }, [pathname]);

  return null;
}
