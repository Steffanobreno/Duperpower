import "server-only";
import { regionOf, type Region } from "./region";
import { setRegion } from "./region-store";

/** For a client page: the business's region read in the client's language, kept for this page. */
export function regionForPage(b: { country?: string | null; currency?: string | null }, lang: string): Region {
  const r = regionOf(b.country, b.currency, lang);
  setRegion(r);
  return r;
}
