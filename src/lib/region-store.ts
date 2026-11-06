import { cache } from "react";
import { DEFAULT_REGION, type Region } from "./region";

// The region (country, currency, locale) of the page being drawn, so money(), dayLabel() and
// timeLabel() format for it without passing it everywhere. Server: one per request (React
// cache), set where the business is loaded (getOwnerI18n, the client pages). Outside a page
// render (server actions, routes, the message cron) it is not kept: pass the region instead.
// Browser parts read it from the I18nProvider (useRegion) to match the server's HTML.

const store = cache(() => ({ region: null as Region | null }));

export function setRegion(r: Region) {
  try {
    store().region = r;
  } catch { /* not in a request */ }
}

export function currentRegion(): Region {
  try {
    return store().region ?? DEFAULT_REGION;
  } catch {
    return DEFAULT_REGION;
  }
}
