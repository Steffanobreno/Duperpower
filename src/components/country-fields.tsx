"use client";
import { useEffect, useMemo, useState } from "react";
import ct from "countries-and-timezones";
import { currencyOf, mainZoneOf, zoneLabel, zonesOf } from "@/lib/countries";
import { useT } from "./i18n";
import { Field, Select } from "./ui";

export type PlaceNames = { countries: { code: string; name: string }[]; currencies: { code: string; name: string }[] };

/**
 * Country, currency and time zone, together: picking a country suggests its currency and
 * lists its time zones.
 */
export function CountryFields({ country: initialCountry, currency: initialCurrency, timezone: initialZone, showCurrency = true, guess = false, names }: {
  country: string; currency: string; timezone: string; showCurrency?: boolean;
  /** Country and currency names, made on the server (the browser's own names can differ). */
  names: PlaceNames;
  /** At signup: start from the phone's own time zone (and its country). */
  guess?: boolean;
}) {
  const { t } = useT();
  const [country, setCountry] = useState(initialCountry);
  const [currency, setCurrency] = useState(initialCurrency);
  const [zone, setZone] = useState(initialZone);
  const countries = names.countries;
  const currencies = useMemo(() => {
    const first = [currencyOf(country), "USD", "EUR", "GBP"];
    return [...first.map((code) => names.currencies.find((c) => c.code === code)).filter((c) => !!c),
            ...names.currencies.filter((c) => !first.includes(c.code))];
  }, [country, names.currencies]);
  /* eslint-disable react-hooks/set-state-in-effect -- the phone's time zone is only known in the browser, after hydration */
  useEffect(() => {
    if (!guess) return;
    try {
      const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const where = ct.getTimezone(z)?.countries ?? [];
      if (!where.length) return;
      const c: string = (where as string[]).includes(initialCountry) ? initialCountry : where[0];
      setCountry(c);
      setCurrency(currencyOf(c));
      setZone(z);
    } catch { /* keep the server's guess */ }
  }, [guess, initialCountry]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const zones = useMemo(() => {
    const list = zonesOf(country);
    return list.includes(zone) ? list : [zone, ...list];
  }, [country, zone]);

  return (
    <>
      <Field label={t("Country")} hint={t("Phone numbers, addresses, the map, distances and holidays follow it.")}>
        <Select name="country" aria-label={t("Country")} value={country} onChange={(e) => {
          const c = e.target.value;
          setCountry(c);
          setCurrency(currencyOf(c));
          if (!zonesOf(c).includes(zone)) setZone(mainZoneOf(c));
        }}>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </Select>
      </Field>
      {showCurrency ? (
        <Field label={t("Currency")} hint={t("Prices, receipts and reports use it.")}>
          <Select name="currency" aria-label={t("Currency")} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
        </Field>
      ) : <input type="hidden" name="currency" value={currency} />}
      <Field label={t("Time zone")} hint={t("Every time in the app, texts and the booking page uses it.")}>
        <Select name="timezone" aria-label={t("Time zone")} value={zone} onChange={(e) => setZone(e.target.value)}>
          {zones.map((z) => <option key={z} value={z}>{zoneLabel(z)}</option>)}
        </Select>
      </Field>
    </>
  );
}
