import ct from "countries-and-timezones";
import currencyOfCountry from "country-to-currency";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";

// Countries, currencies, time zones and phone numbers of the whole world (server side and the
// few forms that pick them).

export const isCountry = (c: unknown): c is string => typeof c === "string" && /^[A-Z]{2}$/.test(c) && !!ct.getCountry(c);

let currencies: Set<string> | null = null;
export const isCurrency = (c: unknown): c is string =>
  typeof c === "string" && (currencies ??= new Set(Intl.supportedValuesOf("currency"))).has(c);

export const currencyOf = (country: string) =>
  (currencyOfCountry as Record<string, string>)[country] ?? "USD";


/** Every country, by name in the given language. */
export function countryList(lang = "en"): { code: string; name: string }[] {
  const names = new Intl.DisplayNames([lang, "en"], { type: "region" });
  return Object.keys(ct.getAllCountries())
    .map((code) => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
}

export const countryName = (code: string, lang = "en") =>
  new Intl.DisplayNames([lang, "en"], { type: "region" }).of(code) ?? code;

/** Currencies to pick from: the country's own first, then the common ones, then all. */
export function currencyList(country: string, lang = "en"): { code: string; name: string }[] {
  const names = new Intl.DisplayNames([lang, "en"], { type: "currency" });
  const first = [currencyOf(country), "USD", "EUR", "GBP"];
  const all = Intl.supportedValuesOf("currency");
  return [...new Set([...first, ...all])].map((code) => ({ code, name: `${code} · ${names.of(code) ?? code}` }));
}

// Countries with several time zones: the one most people live in.
const MAIN_ZONE: Record<string, string> = {
  US: "America/New_York", CA: "America/Toronto", MX: "America/Mexico_City", BR: "America/Sao_Paulo",
  AR: "America/Argentina/Buenos_Aires", CL: "America/Santiago", AU: "Australia/Sydney", NZ: "Pacific/Auckland",
  RU: "Europe/Moscow", ID: "Asia/Jakarta", CN: "Asia/Shanghai", KZ: "Asia/Almaty", ES: "Europe/Madrid",
  PT: "Europe/Lisbon", DE: "Europe/Berlin", EC: "America/Guayaquil", CD: "Africa/Kinshasa", MN: "Asia/Ulaanbaatar",
  UA: "Europe/Kyiv", MY: "Asia/Kuala_Lumpur", UZ: "Asia/Tashkent", FR: "Europe/Paris", GB: "Europe/London",
};

/** The country's own time zones (for the picker), its main one first; every zone when it has none. */
export function zonesOf(country: string): string[] {
  const all: string[] = ct.getTimezonesForCountry(country as never)?.map((z) => z.name as string) ?? [];
  const own = all.filter((z) => !z.startsWith("Antarctica/") && ct.getTimezone(z as never)?.countries?.[0] === country);
  const list = own.length ? own : all;
  if (!list.length) return Intl.supportedValuesOf("timeZone");
  const main = mainZoneOf(country);
  return list.includes(main) ? [main, ...list.filter((z) => z !== main)] : list;
}

export const isZone = (z: unknown): z is string => {
  if (typeof z !== "string" || !z) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: z });
    return true;
  } catch {
    return false;
  }
};

/** "America/Sao_Paulo" → "Sao Paulo (UTC−3)". */
export function zoneLabel(zone: string) {
  const city = zone.split("/").pop()!.replace(/_/g, " ");
  let offset = "";
  try {
    offset = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" })
      .formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value.replace("GMT", "UTC") ?? "";
  } catch { /* keep it plain */ }
  return offset ? `${city} (${offset === "UTC" ? "UTC" : offset})` : city;
}

/** The country's main time zone (its first listed one). */
export function mainZoneOf(country: string) {
  if (MAIN_ZONE[country]) return MAIN_ZONE[country];
  const zones = ct.getCountry(country as never)?.timezones ?? [];
  return zones.find((z) => ct.getTimezone(z as never)?.countries?.[0] === country) ?? zones[0] ?? "America/Los_Angeles";
}

/** Typed phone → E.164 (+5511987654321), or null. US/Canada numbers keep the 10-digit rule. */
export function toE164(input: string, country = "US"): string | null {
  const raw = input.trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (country === "US" || country === "CA") {
    if (!raw.startsWith("+") || raw.startsWith("+1")) {
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
      if (!raw.startsWith("+")) return null;
    }
  }
  const n = parsePhoneNumberFromString(raw, country as never);
  return n && n.isPossible() ? n.number : null;
}

/** E.164 → how people write it: national style at home, international for other countries. */
export function phoneText(e164: string | null | undefined, country = "US") {
  if (!e164) return "";
  const us = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (us && (country === "US" || country === "CA")) return `(${us[1]}) ${us[2]}-${us[3]}`;
  const n = parsePhoneNumberFromString(e164);
  if (!n) return e164;
  return n.country === country ? n.formatNational() : n.formatInternational();
}


/** Where a visitor probably is: the host's country header, else their browser language's region. */
export function guessCountry(h: Headers) {
  const direct = (h.get("x-country") ?? h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? "").toUpperCase();
  if (isCountry(direct)) return direct;
  try {
    const geo = h.get("x-nf-geo");
    const c = geo ? JSON.parse(Buffer.from(geo, "base64").toString("utf8"))?.country?.code : null;
    if (isCountry(c)) return c as string;
  } catch { /* not on Netlify */ }
  for (const part of (h.get("accept-language") ?? "").split(",")) {
    const region = part.split(";")[0].trim().split("-")[1]?.toUpperCase();
    if (isCountry(region)) return region;
  }
  return "US";
}
