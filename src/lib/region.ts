// Where the business works: its country decides phone numbers, addresses, the map search,
// miles or kilometers, inches/pounds or centimeters/kilograms; plus the currency it charges in.
// `locale` (language + country) formats money, dates and times.

export type Region = {
  country: string;
  currency: string;
  locale: string;
  /** Distances in kilometers (false: miles). Stored in miles either way. */
  km: boolean;
  /** Heights in centimeters (false: inches). */
  metric: boolean;
  /** Weights in kilograms (false: pounds). Stored in pounds either way. */
  kg: boolean;
  /** How the business sorts dogs into sizes: by height at the shoulder, or by weight. */
  sizeBy: "height" | "weight";
};

/** The business's own unit choices (null: what its country uses). */
export type Units = { size_by?: string | null; length_unit?: string | null; weight_unit?: string | null };

const MILES = new Set(["US", "GB", "LR", "MM", "PR", "VI", "GU", "AS", "MP", "UM"]);
const IMPERIAL = new Set(["US", "LR", "MM", "PR", "VI", "GU", "AS", "MP", "UM"]);

const isCode = (c: unknown): c is string => typeof c === "string" && /^[A-Z]{2}$/.test(c);
const isMoneyCode = (c: unknown): c is string => typeof c === "string" && /^[A-Z]{3}$/.test(c);

/** The region of a business (country and currency as stored), read in the given language. */
export function regionOf(country: string | null | undefined, currency?: string | null, lang = "en", units?: Units | null): Region {
  const c = isCode(country) ? country : "US";
  const cur = isMoneyCode(currency) ? currency : "USD";
  const imperial = IMPERIAL.has(c);
  return {
    country: c, currency: cur, locale: `${lang}-${c}`, km: !MILES.has(c),
    metric: units?.length_unit ? units.length_unit === "cm" : !imperial,
    kg: units?.weight_unit ? units.weight_unit === "kg" : !imperial,
    sizeBy: units?.size_by === "weight" ? "weight" : "height",
  };
}

export const DEFAULT_REGION: Region = regionOf("US", "USD", "en");

export const KM_PER_MILE = 1.609344;
/** Miles (as stored) → the number shown in the business's unit. */
export const distanceOut = (miles: number, r: Region) => (r.km ? Math.round(miles * KM_PER_MILE) : miles);
/** A number typed in the business's unit → miles to store. */
export const distanceIn = (n: number, r: Region) => (r.km ? Math.round((n / KM_PER_MILE) * 10) / 10 : n);

/** Postal code check: 5 digits in the US, otherwise letters, numbers, spaces and dashes. */
export function postalOk(code: string, country: string) {
  if (country === "US") return /^\d{5}(-\d{4})?$/.test(code);
  return /^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/.test(code);
}

/** The country's main language ("BR" → "pt"), for what goes to its clients (dates in texts). */
export function countryLang(country: string) {
  try {
    return new Intl.Locale(`und-${country}`).maximize().language || "en";
  } catch {
    return "en";
  }
}

/** The region for messages sent to a business's clients: its country's language. */
export const messageRegion = (country?: string | null, currency?: string | null) =>
  regionOf(country, currency, countryLang(regionOf(country).country));
