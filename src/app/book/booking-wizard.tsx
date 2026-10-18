"use client";
import { useState, useTransition, type ReactNode } from "react";
import { Button, Field, Input, Notice, Textarea } from "@/components/ui";
import { minutesLabel, money, SIZES } from "@/lib/format";
import type { DaySlots } from "@/lib/booking";
import { availabilityAction, requestBookingAction, type PetRequest } from "./actions";

type Service = {
  id: string;
  name: string;
  kind: "service" | "addon";
  category: string | null;
  size_class: string | null;
  description: string | null;
  duration_min: number;
  price_cents: number;
};

const emptyPet = (): PetRequest => ({ name: "", breed: "", size: "", serviceIds: [] });

export function BookingWizard({
  services,
  businessPhone,
  agreement,
}: {
  services: Service[];
  businessPhone: string;
  agreement: ReactNode | null;
}) {
  const [pets, setPets] = useState<PetRequest[]>([emptyPet()]);
  const [address, setAddress] = useState({ address: "", city: "", zip: "" });
  const [days, setDays] = useState<DaySlots[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [contact, setContact] = useState({ firstName: "", lastName: "", phone: "", email: "", notes: "", website: "" });
  const [consent, setConsent] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mains = services.filter((s) => s.kind === "service");
  const addons = services.filter((s) => s.kind === "addon");
  const byId = new Map(services.map((s) => [s.id, s]));
  const chosen = pets.flatMap((p) => p.serviceIds.map((id) => byId.get(id)).filter((s): s is Service => !!s));
  const total = chosen.reduce((s, x) => s + x.price_cents, 0);
  const minutes = chosen.reduce((s, x) => s + x.duration_min, 0);
  const petsReady = pets.every((p) => p.name.trim() && p.size && p.serviceIds.some((id) => byId.get(id)?.kind === "service"));

  // Changing pets or address invalidates the times already shown.
  const resetTimes = () => {
    setDays(null);
    setDay(null);
    setStart(null);
  };
  const updatePet = (i: number, patch: Partial<PetRequest>) => {
    setPets(pets.map((p, j) => (j === i ? { ...p, ...patch } : p)));
    resetTimes();
  };

  const findTimes = () => {
    setError(null);
    startTransition(async () => {
      const res = await availabilityAction({ zip: address.zip, pets });
      if (res.error) {
        setError(res.error);
        setDays(null);
      } else {
        setDays(res.days ?? []);
        setDay(res.days?.[0]?.date ?? null);
      }
    });
  };

  const submit = () => {
    if (!start) return;
    setError(null);
    startTransition(async () => {
      const res = await requestBookingAction({ pets, start, ...address, ...contact, smsConsent: consent, agreed, signature });
      if (res.error) setError(res.error);
      else setDone(res.when ?? "your chosen time");
    });
  };

  if (done) {
    return (
      <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center">
        <p className="text-4xl" aria-hidden>🐾</p>
        <h2 className="text-xl font-bold">Request sent!</h2>
        <p>
          We received your request for <strong>{done}</strong>. We&apos;ll text you as soon as it&apos;s confirmed.
        </p>
        <p className="text-sm text-muted">Questions? Text us at {businessPhone}.</p>
      </div>
    );
  }

  const selectedDay = days?.find((d) => d.date === day);

  return (
    <div className="space-y-6">
      {/* 1. Pets and services */}
      <section aria-labelledby="pets-h" className="space-y-3">
        <h2 id="pets-h" className="text-lg font-bold">1. Your pet{pets.length > 1 ? "s" : ""}</h2>
        {pets.map((pet, i) => {
          const fits = mains.filter((s) => !s.size_class || s.size_class === pet.size);
          const main = pet.serviceIds.find((id) => byId.get(id)?.kind === "service") ?? "";
          const extras = pet.serviceIds.filter((id) => byId.get(id)?.kind === "addon");
          return (
            <fieldset key={i} className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <legend className="sr-only">Pet {i + 1}</legend>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Pet's name">
                  <Input value={pet.name} onChange={(e) => updatePet(i, { name: e.target.value })} autoComplete="off" />
                </Field>
                <Field label="Breed">
                  <Input value={pet.breed} onChange={(e) => updatePet(i, { breed: e.target.value })} autoComplete="off" />
                </Field>
              </div>
              <div role="radiogroup" aria-label="Size" className="space-y-1">
                <p className="text-sm font-medium">Size</p>
                <p className="text-xs text-muted">Height from the floor to the top of the shoulders.</p>
                <div className="grid grid-cols-2 gap-2">
                  {SIZES.map((s) => (
                    <label
                      key={s.value}
                      className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${
                        pet.size === s.value ? "border-brand bg-brand-soft font-semibold text-brand-strong" : "border-line"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`size-${i}`}
                        value={s.value}
                        checked={pet.size === s.value}
                        onChange={() => updatePet(i, { size: s.value, serviceIds: [] })}
                        className="sr-only"
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
              {pet.size && (
                <div role="radiogroup" aria-label="Service" className="space-y-2">
                  <p className="text-sm font-medium">Service</p>
                  {fits.map((s) => (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 ${
                        main === s.id ? "border-brand bg-brand-soft" : "border-line"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`service-${i}`}
                        checked={main === s.id}
                        onChange={() => updatePet(i, { serviceIds: [s.id, ...extras] })}
                        className="h-4 w-4"
                      />
                      <span className="flex-1">
                        <span className="block font-medium">{s.category ?? s.name}</span>
                        <span className="block text-xs text-muted">{s.name} · {minutesLabel(s.duration_min)}</span>
                      </span>
                      <span className="font-semibold">{money(s.price_cents)}</span>
                    </label>
                  ))}
                  {addons.length > 0 && (
                    <details className="rounded-xl border border-line px-3 py-2">
                      <summary className="cursor-pointer text-sm font-medium">
                        Extras{extras.length ? ` (${extras.length})` : ""}
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {addons.map((a) => (
                          <li key={a.id}>
                            <label className="flex items-center gap-3 py-1 text-sm">
                              <input
                                type="checkbox"
                                checked={extras.includes(a.id)}
                                onChange={(e) =>
                                  updatePet(i, {
                                    serviceIds: [
                                      ...(main ? [main] : []),
                                      ...(e.target.checked ? [...extras, a.id] : extras.filter((x) => x !== a.id)),
                                    ],
                                  })
                                }
                                className="h-4 w-4"
                              />
                              <span className="flex-1">{a.name}</span>
                              <span className="text-muted">{a.price_cents ? money(a.price_cents) : "Included"}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
              {pets.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setPets(pets.filter((_, j) => j !== i));
                    resetTimes();
                  }}
                  className="text-sm text-danger underline"
                >
                  Remove this pet
                </button>
              )}
            </fieldset>
          );
        })}
        {pets.length < 4 && (
          <Button
            type="button"
            kind="secondary"
            onClick={() => {
              setPets([...pets, emptyPet()]);
              resetTimes();
            }}
          >
            Add another pet
          </Button>
        )}
      </section>

      {/* 2. Address */}
      <section aria-labelledby="where-h" className="space-y-3">
        <h2 id="where-h" className="text-lg font-bold">2. Where should we park the van?</h2>
        <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <Field label="Street address">
            <Input
              value={address.address}
              onChange={(e) => setAddress({ ...address, address: e.target.value })}
              autoComplete="street-address"
            />
          </Field>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Field label="City">
              <Input
                value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
                autoComplete="address-level2"
              />
            </Field>
            <Field label="ZIP code">
              <Input
                value={address.zip}
                inputMode="numeric"
                maxLength={5}
                onChange={(e) => {
                  setAddress({ ...address, zip: e.target.value.replace(/\D/g, "") });
                  resetTimes();
                }}
                autoComplete="postal-code"
              />
            </Field>
          </div>
        </div>
        {!days && (
          <Button
            type="button"
            className="w-full"
            disabled={pending || !petsReady || address.zip.length !== 5}
            onClick={findTimes}
          >
            {pending ? "Looking for times…" : "See available times"}
          </Button>
        )}
        {!petsReady && <p className="text-center text-xs text-muted">Choose a size and service for each pet first.</p>}
      </section>

      {error && <Notice kind="error">{error}</Notice>}

      {/* 3. Time */}
      {days && days.length > 0 && (
        <section aria-labelledby="when-h" className="space-y-3">
          <h2 id="when-h" className="text-lg font-bold">3. Pick a time</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Day">
            {days.map((d) => (
              <button
                key={d.date}
                type="button"
                role="tab"
                aria-selected={d.date === day}
                onClick={() => {
                  setDay(d.date);
                  setStart(null);
                }}
                className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold ${
                  d.date === day ? "border-brand bg-brand text-on-brand" : "border-line bg-surface"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          {selectedDay && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {selectedDay.times.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={start === t.value}
                  onClick={() => setStart(t.value)}
                  className={`rounded-xl border px-2 py-2.5 text-sm font-semibold ${
                    start === t.value ? "border-brand bg-brand text-on-brand" : "border-line bg-surface"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted">The time is when we arrive. Visits take about {minutesLabel(minutes)}.</p>
        </section>
      )}

      {/* 4. Contact */}
      {start && (
        <section aria-labelledby="you-h" className="space-y-3">
          <h2 id="you-h" className="text-lg font-bold">4. Your details</h2>
          <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <Input value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} autoComplete="given-name" />
              </Field>
              <Field label="Last name">
                <Input value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} autoComplete="family-name" />
              </Field>
            </div>
            <Field label="Mobile phone">
              <Input type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} autoComplete="tel" placeholder="(650) 555-0123" />
            </Field>
            <Field label="Email">
              <Input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" />
            </Field>
            <Field label="Anything we should know? (optional)">
              <Textarea value={contact.notes} onChange={(e) => setContact({ ...contact, notes: e.target.value })} placeholder="Gate code, matting, nervous with the dryer…" />
            </Field>
            {/* Hidden from people; bots fill it in. */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Website
                <input tabIndex={-1} autoComplete="off" value={contact.website} onChange={(e) => setContact({ ...contact, website: e.target.value })} />
              </label>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4" />
              <span>Text me about my appointments (confirmations and reminders). Just tell us anytime if you’d rather not get texts.</span>
            </label>
          </div>
          {agreement && (
            <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <div className="max-h-72 overflow-y-auto rounded-xl border border-line bg-bg p-3" tabIndex={0} aria-label="Service agreement">
                {agreement}
              </div>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4" />
                <span>I have read and agree to the service agreement.</span>
              </label>
              <Field label="Type your full name to sign">
                <Input value={signature} onChange={(e) => setSignature(e.target.value)} autoComplete="name" />
              </Field>
            </div>
          )}
          <div className="flex items-center justify-between rounded-xl bg-brand-soft px-4 py-3 text-brand-strong">
            <span>Estimated total</span>
            <span className="text-lg font-bold">{money(total)}</span>
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={pending || (!!agreement && (!agreed || signature.trim().length < 3))}
            onClick={submit}
          >
            {pending ? "Sending…" : "Request this appointment"}
          </Button>
          <p className="text-center text-xs text-muted">
            This is a request. We&apos;ll confirm by text. Final price may change for matting or behavior.
          </p>
        </section>
      )}
    </div>
  );
}
