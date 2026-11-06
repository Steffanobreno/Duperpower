// Holidays by year: the US list below, and every other country's public holidays from
// date-holidays. The owner picks which ones the business closes for (businesses.closed_holidays).
import Holidays from "date-holidays";

const pad = (n: number) => String(n).padStart(2, "0");
const ymdOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** The nth weekday of a month (n = -1 for the last one). weekday: 0 = Sunday. */
function nthWeekday(y: number, m: number, weekday: number, n: number) {
  if (n > 0) {
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay();
  return lastDay - ((last - weekday + 7) % 7);
}

/** Easter Sunday (Gregorian), "Anonymous" algorithm. */
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  return { month, day: ((h + l - 7 * m + 114) % 31) + 1 };
}

export const HOLIDAYS: { key: string; name: string; date: (y: number) => string }[] = [
  { key: "new_year", name: "New Year's Day", date: (y) => ymdOf(y, 1, 1) },
  { key: "mlk", name: "Martin Luther King Jr. Day", date: (y) => ymdOf(y, 1, nthWeekday(y, 1, 1, 3)) },
  { key: "valentines", name: "Valentine's Day", date: (y) => ymdOf(y, 2, 14) },
  { key: "presidents", name: "Presidents' Day", date: (y) => ymdOf(y, 2, nthWeekday(y, 2, 1, 3)) },
  { key: "easter", name: "Easter Sunday", date: (y) => { const e = easter(y); return ymdOf(y, e.month, e.day); } },
  { key: "mothers", name: "Mother's Day", date: (y) => ymdOf(y, 5, nthWeekday(y, 5, 0, 2)) },
  { key: "memorial", name: "Memorial Day", date: (y) => ymdOf(y, 5, nthWeekday(y, 5, 1, -1)) },
  { key: "juneteenth", name: "Juneteenth", date: (y) => ymdOf(y, 6, 19) },
  { key: "fathers", name: "Father's Day", date: (y) => ymdOf(y, 6, nthWeekday(y, 6, 0, 3)) },
  { key: "independence", name: "Independence Day", date: (y) => ymdOf(y, 7, 4) },
  { key: "labor", name: "Labor Day", date: (y) => ymdOf(y, 9, nthWeekday(y, 9, 1, 1)) },
  { key: "columbus", name: "Columbus Day", date: (y) => ymdOf(y, 10, nthWeekday(y, 10, 1, 2)) },
  { key: "halloween", name: "Halloween", date: (y) => ymdOf(y, 10, 31) },
  { key: "veterans", name: "Veterans Day", date: (y) => ymdOf(y, 11, 11) },
  { key: "thanksgiving", name: "Thanksgiving Day", date: (y) => ymdOf(y, 11, nthWeekday(y, 11, 4, 4)) },
  { key: "black_friday", name: "Day after Thanksgiving", date: (y) => ymdOf(y, 11, nthWeekday(y, 11, 4, 4) + 1) },
  { key: "christmas_eve", name: "Christmas Eve", date: (y) => ymdOf(y, 12, 24) },
  { key: "christmas", name: "Christmas Day", date: (y) => ymdOf(y, 12, 25) },
  { key: "new_years_eve", name: "New Year's Eve", date: (y) => ymdOf(y, 12, 31) },
];

export type Holiday = { key: string; name: string; date: (y: number) => string };

// Other countries: a holiday's key is its rule ("12-25", "easter -2"), so it stays the same every year.
const keyOf = (rule: string) => {
  let h = 0;
  for (const ch of rule) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return `h${(h >>> 0).toString(36)}`;
};
const yearCache = new Map<string, { key: string; name: string; date: string }[]>();
function yearList(country: string, y: number, lang: string) {
  const k = `${country}|${y}|${lang}`;
  let list = yearCache.get(k);
  if (!list) {
    list = [];
    try {
      const hd = new Holidays(country);
      const seen = new Set<string>();
      for (const h of hd.getHolidays(y, lang) || []) {
        if (h.type !== "public" && h.type !== "bank") continue;
        const key = keyOf(h.rule);
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({ key, name: h.name, date: h.date.slice(0, 10) });
      }
    } catch { /* a country date-holidays doesn't know: no holidays */ }
    yearCache.set(k, list);
  }
  return list;
}

/** The holidays a business can close for, in its country (names in `lang` where known). */
export function holidaysFor(country: string, lang = "en"): Holiday[] {
  if (country === "US") return HOLIDAYS;
  const y = new Date().getUTCFullYear();
  const byKey = new Map<string, string>();
  for (const h of [...yearList(country, y, lang), ...yearList(country, y + 1, lang)]) if (!byKey.has(h.key)) byKey.set(h.key, h.name);
  return [...byKey].map(([key, name]) => ({ key, name, date: (yy: number) => yearList(country, yy, lang).find((x) => x.key === key)?.date ?? "" }));
}

/** The closed holiday on this day, if any. */
export function closedHoliday(date: string, closed: string[], country = "US", lang = "en") {
  if (!closed.length) return null;
  const y = Number(date.slice(0, 4));
  return holidaysFor(country, lang).find((h) => closed.includes(h.key) && h.date(y) === date) ?? null;
}
