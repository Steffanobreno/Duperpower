import { msg, type T } from "@/lib/i18n";
// Repeating visits ("every 2 weeks", "every month", "after 10 times"): the dates a rule gives.
// Pure functions, used by the repeat form (live list) and the server (to book them).

export type RepeatRule = {
  /** "dates": the visit repeats on the days picked one by one (in `dates`). */
  freq: "day" | "week" | "month" | "dates";
  every: number; // 1–52
  count: number | null; // how many visits in total, this one included (at most 100)
  until: string | null; // or the last day (yyyy-MM-dd)
  dates?: string[]; // with freq "dates": the days picked (yyyy-MM-dd)
  times?: Record<string, string>; // and, for any of them, another start time ("HH:mm")
};

export const MAX_VISITS = 100;
const MAX_DAYS = 2 * 366; // never more than about two years ahead

const pad = (n: number) => String(n).padStart(2, "0");
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1–12

function step(first: string, rule: RepeatRule, k: number) {
  const [y, m, d] = first.split("-").map(Number);
  if (rule.freq === "month") {
    // Same day of the month; the 31st becomes the last day of shorter months.
    const total = m - 1 + k * rule.every;
    const yy = y + Math.floor(total / 12);
    const mm = (total % 12) + 1;
    return `${yy}-${pad(mm)}-${pad(Math.min(d, daysIn(yy, mm)))}`;
  }
  const t = new Date(Date.UTC(y, m - 1, d + k * rule.every * (rule.freq === "week" ? 7 : 1)));
  return t.toISOString().slice(0, 10);
}

/** Every date of the rule, starting with `first` itself. */
export function repeatDates(first: string, rule: RepeatRule) {
  if (rule.freq === "dates") {
    const picked = [...new Set(rule.dates ?? [])].filter((d) => d > first).sort();
    return [first, ...picked].slice(0, MAX_VISITS);
  }
  const limit = Math.min(rule.count ?? MAX_VISITS, MAX_VISITS);
  const last = new Date(Date.UTC(+first.slice(0, 4), +first.slice(5, 7) - 1, +first.slice(8, 10) + MAX_DAYS)).toISOString().slice(0, 10);
  const end = rule.until && rule.until < last ? rule.until : last;
  const out: string[] = [];
  for (let k = 0; out.length < limit; k++) {
    const d = step(first, rule, k);
    if (d > end) break;
    out.push(d);
  }
  return out;
}

const WEEKDAYS = [msg("Sunday"), msg("Monday"), msg("Tuesday"), msg("Wednesday"), msg("Thursday"), msg("Friday"), msg("Saturday")];
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...o });

/** "Every 2 weeks on Friday, 10 times", in the language of t(). */
export function ruleLabel(first: string, rule: RepeatRule, t: T = (s, v) => s.replace(/\{(\w+)\}/g, (m, k: string) => String(v?.[k] ?? m))) {
  if (rule.freq === "dates") {
    const n = rule.dates ? repeatDates(first, rule).length : rule.count ?? 0;
    return n === 1 ? t("On 1 chosen date") : t("On {n} chosen dates", { n });
  }
  const day = t(WEEKDAYS[new Date(`${first}T12:00:00Z`).getUTCDay()]);
  const d = Number(first.slice(8));
  const n = rule.every;
  const base = rule.freq === "week" ? (n === 1 ? t("Every week on {day}", { day }) : t("Every {n} weeks on {day}", { n, day }))
    : rule.freq === "month" ? (n === 1 ? t("Every month on day {d}", { d }) : t("Every {n} months on day {d}", { n, d }))
      : n === 1 ? t("Every day") : t("Every {n} days", { n });
  const ends = rule.count ? t(", {n} times", { n: rule.count })
    : rule.until ? t(", until {date}", { date: fmt(rule.until, { month: "short", day: "numeric", year: "numeric" }) }) : "";
  return base + ends;
}
