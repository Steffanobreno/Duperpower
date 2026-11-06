import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { msg } from "@/lib/i18n";
import { phoneText, toE164 } from "./countries";
import type { Region } from "./region";
import { currentRegion } from "./region-store";

// Money, dates and times follow the business's region (currency, language + country): the
// page's region by default (see region-store), or the one passed in.

const nfCache = new Map<string, Intl.NumberFormat>();
const dfCache = new Map<string, Intl.DateTimeFormat>();
const nf = (locale: string, currency: string) => {
  const k = `${locale}|${currency}`;
  let f = nfCache.get(k);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, { style: "currency", currency });
    } catch {
      f = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    }
    nfCache.set(k, f);
  }
  return f;
};
const df = (locale: string, tz: string, opts: Intl.DateTimeFormatOptions) => {
  const k = `${locale}|${tz}|${JSON.stringify(opts)}`;
  let f = dfCache.get(k);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: tz });
    } catch {
      f = new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz });
    }
    dfCache.set(k, f);
  }
  return f;
};
// Newer ICU puts a narrow no-break space before AM/PM; plain spaces read (and match) the same.
const plain = (s: string) => s.replace(/[\u202f\u00a0]/g, " ");

export const money = (cents: number, r: Region = currentRegion()) => plain(nf(r.locale, r.currency).format(cents / 100));

/** Parses an amount typed by a person ("45", "45.5", "$1,200.00", "1.200,50") into cents. */
export function parseMoney(input: FormDataEntryValue | null): number | null {
  let text = String(input ?? "").replace(/[^\d.,-]/g, "");
  if (text === "") return null;
  // "1.200,50" or "45,5": the comma is the decimal mark.
  if (/,\d{1,2}$/.test(text)) text = text.replace(/\./g, "").replace(",", ".");
  else text = text.replace(/,/g, "");
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export const minutesLabel = (min: number) => {
  if (min === 0) return msg("no extra time");
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h}h` : "", m ? `${m}min` : ""].filter(Boolean).join(" ");
};

/** "2026-10-20" + "09:00" in the business time zone -> a UTC Date. */
export const zonedToUtc = (date: string, time: string, tz: string) =>
  fromZonedTime(`${date}T${time}:00`, tz);

export const ymd = (d: Date, tz: string) => formatInTimeZone(d, tz, "yyyy-MM-dd");
export const hm = (d: Date, tz: string) => formatInTimeZone(d, tz, "HH:mm");
export const timeLabel = (d: Date, tz: string, r: Region = currentRegion()) =>
  plain(df(r.locale, tz, { hour: "numeric", minute: "2-digit" }).format(d));
export const dayLabel = (d: Date, tz: string, r: Region = currentRegion()) =>
  plain(df(r.locale, tz, { weekday: "short", month: "short", day: "numeric" }).format(d));
export const longDayLabel = (d: Date, tz: string, r: Region = currentRegion()) =>
  plain(df(r.locale, tz, { weekday: "long", month: "long", day: "numeric" }).format(d));

/** Today's date (yyyy-MM-dd) in the business time zone. */
export const todayYmd = (tz: string) => ymd(new Date(), tz);

/** Adds days to a yyyy-MM-dd string without time zone surprises. */
export function addDaysYmd(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday, for a yyyy-MM-dd string. */
export const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** Start (UTC) of the given local day and of the next one, for range queries. */
export function dayRangeUtc(date: string, tz: string) {
  return { start: zonedToUtc(date, "00:00", tz), end: zonedToUtc(addDaysYmd(date, 1), "00:00", tz) };
}

export const isUuid = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export const isYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** An E.164 number for display: (650) 555-0123 at home, +55 11 98765-4321 from abroad. */
export function phoneLabel(e164: string | null | undefined, country: string = currentRegion().country) {
  return phoneText(e164, country);
}

/** A phone typed in any format → E.164 (+16505550123), read in the business's country; or null. */
export function normalizePhone(input: FormDataEntryValue | null, country: string = currentRegion().country): string | null {
  return toE164(String(input ?? ""), country);
}

export const SIZES = [
  { value: "small", label: msg('Small (12" or less)') },
  { value: "medium", label: msg('Medium (12"–16")') },
  { value: "large", label: msg('Large (16"–20")') },
  { value: "xlarge", label: msg('X-Large (20" or up)') },
] as const;
export type SizeClass = (typeof SIZES)[number]["value"];
const SIZES_CM: Record<SizeClass, string> = {
  small: msg("Small (30 cm or less)"),
  medium: msg("Medium (30–40 cm)"),
  large: msg("Large (40–50 cm)"),
  xlarge: msg("X-Large (50 cm or up)"),
};
const SIZES_LB: Record<SizeClass, string> = {
  small: msg("Small (up to 20 lb)"),
  medium: msg("Medium (21–50 lb)"),
  large: msg("Large (51–90 lb)"),
  xlarge: msg("X-Large (91 lb or more)"),
};
const SIZES_KG: Record<SizeClass, string> = {
  small: msg("Small (up to 9 kg)"),
  medium: msg("Medium (10–22 kg)"),
  large: msg("Large (23–40 kg)"),
  xlarge: msg("X-Large (41 kg or more)"),
};
type SizeUnits = Pick<Region, "metric" | "kg" | "sizeBy">;
/** The sizes as the business measures them: height in inches or cm, or weight in lb or kg. */
export const sizesFor = (r: SizeUnits) => SIZES.map((s) => ({
  value: s.value,
  label: r.sizeBy === "weight" ? (r.kg ? SIZES_KG : SIZES_LB)[s.value] : r.metric ? SIZES_CM[s.value] : s.label,
}));
export const sizeLabel = (s: string | null, r: SizeUnits = currentRegion()) =>
  sizesFor(r).find((x) => x.value === s)?.label ?? msg("Size not set");

export const LB_PER_KG = 2.20462;
/** The size class for a weight in pounds (for businesses that size dogs by weight). */
export const sizeFromWeight = (lbs: number): SizeClass => (lbs <= 20 ? "small" : lbs <= 50 ? "medium" : lbs <= 90 ? "large" : "xlarge");
/** Pounds (as stored) → the number shown in the business's unit. */
export const weightOut = (lbs: number | string | null | undefined, kg: boolean) =>
  lbs == null || lbs === "" ? "" : kg ? String(Math.round((Number(lbs) / LB_PER_KG) * 10) / 10) : String(Number(lbs));
/** A weight typed in the business's unit ("8,5") → pounds to store, or null. */
export function weightIn(text: string | null | undefined, kg: boolean): number | null {
  const n = Number(String(text ?? "").trim().replace(",", "."));
  if (!String(text ?? "").trim() || !Number.isFinite(n) || n <= 0 || n > 400) return null;
  return Math.round(n * (kg ? LB_PER_KG : 1) * 10) / 10;
}

export const WEEKDAYS = [msg("Sunday"), msg("Monday"), msg("Tuesday"), msg("Wednesday"), msg("Thursday"), msg("Friday"), msg("Saturday")];
