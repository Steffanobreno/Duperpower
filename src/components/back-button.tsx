"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useT } from "./i18n";

// The header's back arrow. It goes back in the browser history to the previous screen of the
// app, and to the page's fixed fallback when there is none (a fresh load, a shared link), so it
// never leaves the app.
//
// How it knows where it is: <NavDepth /> (mounted in the owner layout) wraps history.pushState and
// replaceState and stamps each history entry's state with its position in this run of the app
// (`__finoIdx`, 0 = the entry the app was opened on) and the run's id (`__finoGen`), and keeps the
// URL of every position in sessionStorage. The browser keeps that state with the entry, so after
// Back, Forward, a gesture or a reload, history.state says exactly where we are; nothing is counted.
// Back looks for the closest earlier entry with a different URL (a save that redirects leaves the
// same page twice in a row) and jumps there with history.go.

const URLS = "fino:navUrls";
type Stamp = { idx: number; gen: string };
type NavList = { gen: string; urls: (string | null)[] };

function readList(): NavList | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(URLS) ?? "null");
    return v && typeof v.gen === "string" && Array.isArray(v.urls) ? v : null;
  } catch { return null; }
}
function writeList(list: NavList) {
  try { sessionStorage.setItem(URLS, JSON.stringify(list)); } catch { /* storage blocked: Back falls back */ }
}
function stampOf(state: unknown): Stamp | null {
  const s = state as { __finoIdx?: unknown; __finoGen?: unknown } | null;
  return s && typeof s.__finoIdx === "number" && typeof s.__finoGen === "string" ? { idx: s.__finoIdx, gen: s.__finoGen } : null;
}
/** A URL as the screen it shows: path and query (not the #fragment). */
function screenOf(url: string | URL | null | undefined): string | null {
  try {
    const u = new URL(String(url ?? window.location.href), window.location.href);
    return u.pathname + u.search;
  } catch { return null; }
}
const isObject = (v: unknown) => v == null || (typeof v === "object" && !Array.isArray(v));

export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  const { t } = useT();
  return (
    <button type="button" aria-label={t("Back")} className="-ml-2 rounded-lg p-2 text-white hover:bg-white/10"
      onClick={() => {
        const here = stampOf(window.history.state);
        const list = readList();
        if (here && list?.gen === here.gen) {
          const current = screenOf(window.location.href);
          for (let j = here.idx - 1; j >= 0; j--) {
            const url = list.urls[j];
            if (url && url !== current) {
              window.history.go(j - here.idx);
              return;
            }
          }
        }
        router.push(fallback);
      }}>
      <span aria-hidden>←</span>
    </button>
  );
}

let started = false;

/** Stamps the app's history entries for BackButton. Renders nothing. */
export function NavDepth() {
  useEffect(() => {
    // Once per document: a remount (leaving the owner screens and coming back) keeps the history.
    if (started) return;
    started = true;
    const h = window.history;
    const push = h.pushState.bind(h);
    const replace = h.replaceState.bind(h);

    // The entry the app was opened on. A fresh document entry (typed URL, link from outside) starts a
    // new run at 0: nothing behind it is the app's. A reload or a back/forward into this document keeps
    // its stamp (the browser keeps history.state; Next keeps our keys on its first write, see below).
    let type = "navigate";
    try {
      type = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type ?? "navigate";
    } catch { /* no timing API: treat as fresh */ }
    const here = stampOf(h.state);
    const list = readList();
    if (type === "navigate" || !here) {
      const gen = Math.random().toString(36).slice(2);
      writeList({ gen, urls: [screenOf(null)] });
      if (isObject(h.state)) replace({ ...h.state, __finoIdx: 0, __finoGen: gen }, "");
    } else if (list?.gen === here.gen) {
      list.urls[here.idx] = screenOf(null);
      writeList(list);
    } else {
      // Back into an older run whose URLs are gone: only this entry is known (Back falls back before it).
      writeList({ gen: here.gen, urls: Object.assign([], { [here.idx]: screenOf(null) }) });
    }

    // Next's App Router writes every navigation with history.pushState (a new entry) or replaceState
    // (redirects, router.replace, refreshes), passing a plain object it reads back by its own keys
    // (__NA, __PRIVATE_NEXTJS_INTERNALS_TREE: next/dist/client/components/app-router.js, HistoryUpdater
    // and handlePopState), so extra keys ride along. Its own wrapper (installed after this one) calls
    // through to these.
    const wrapped = h as History & { __finoWrapped?: boolean };
    if (wrapped.__finoWrapped) return;
    wrapped.__finoWrapped = true;
    h.pushState = (data: unknown, unused: string, url?: string | URL | null) => {
      if (!isObject(data)) return push(data, unused, url);
      const cur = stampOf(h.state);
      const l = readList();
      // From an entry of the current run: the next position, and the old forward entries are gone.
      // Otherwise (an unstamped entry) a new run starts here.
      const known = cur && l?.gen === cur.gen;
      const gen = known ? l!.gen : Math.random().toString(36).slice(2);
      const idx = known ? cur!.idx + 1 : 0;
      const urls = known ? l!.urls.slice(0, idx) : [];
      urls[idx] = screenOf(url);
      writeList({ gen, urls });
      push({ ...(data as object), __finoIdx: idx, __finoGen: gen }, unused, url);
    };
    h.replaceState = (data: unknown, unused: string, url?: string | URL | null) => {
      const cur = stampOf(h.state);
      const l = readList();
      if (!isObject(data) || !cur || l?.gen !== cur.gen) return replace(data, unused, url);
      // Same entry, same position; it may show another URL now (a redirect after a save).
      l.urls[cur.idx] = screenOf(url);
      writeList(l);
      replace({ ...(data as object), __finoIdx: cur.idx, __finoGen: cur.gen }, unused, url);
    };
  }, []);

  return null;
}
