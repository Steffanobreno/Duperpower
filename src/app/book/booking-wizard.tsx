"use client";
import { useState, useTransition, type ReactNode } from "react";
import { Button, Field, Input, Notice, Textarea } from "@/components/ui";
import { BreedOptions } from "@/components/breed-options";
import { minutesLabel, money, SIZES } from "@/lib/format";
import { blobToDataUrl, resizeImage } from "@/lib/resize-image";
import type { DaySlots } from "@/lib/booking";
import {
  availabilityAction,
  lookupClientAction,
  requestBookingAction,
  type KnownClient,
  type PetRequest,
} from "./actions";

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

type Who = KnownClient | { known: false; mustSign: boolean };
type Choice = { on: boolean; size: string; serviceIds: string[] };
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
  const [phone, setPhone] = useState("");
  const [who, setWho] = useState<Who | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [newPets, setNewPets] = useState<PetRequest[]>([]);
  const [useFileAddress, setUseFileAddress] = useState(true);
  const [address, setAddress] = useState({ address: "", city: "", zip: "" });
  const [days, setDays] = useState<DaySlots[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [contact, setContact] = useState({ firstName: "", lastName: "", email: "", notes: "", website: "" });
  const [consent, setConsent] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = new Map(services.map((s) => [s.id, s]));
  const known = who?.known === true ? who : null;
  const fileAddress = !!known?.hasAddress && useFileAddress;
  const pets: PetRequest[] = [
    ...(known?.pets ?? [])
      .filter((p) => choices[p.id]?.on)
      .map((p) => ({ petId: p.id, name: p.name, breed: p.breed ?? "", size: choices[p.id].size, serviceIds: choices[p.id].serviceIds })),
    ...newPets,
  ];
  const chosen = pets.flatMap((p) => p.serviceIds.map((id) => byId.get(id)).filter((s): s is Service => !!s));
  const total = chosen.reduce((s, x) => s + x.price_cents, 0);
  const minutes = chosen.reduce((s, x) => s + x.duration_min, 0);
  const petsReady =
    pets.length > 0 && pets.every((p) => p.name.trim() && p.size && p.serviceIds.some((id) => byId.get(id)?.kind === "service"));
  const addressReady = fileAddress || (address.address.trim() && address.city.trim() && address.zip.length === 5);

  const resetTimes = () => {
    setDays(null);
    setDay(null);
    setStart(null);
  };

  const lookup = () => {
    setError(null);
    startTransition(async () => {
      const res = await lookupClientAction(phone);
      if (res.error || res.known === undefined) return setError(res.error ?? "Something went wrong. Please try again.");
      setWho(res);
      if (res.known) {
        setChoices(Object.fromEntries(res.pets.map((p) => [p.id, { on: res.pets.length === 1, size: p.size ?? "", serviceIds: [] }])));
        setNewPets([]);
        setUseFileAddress(res.hasAddress);
      } else {
        setNewPets([emptyPet()]);
      }
      resetTimes();
    });
  };

  const findTimes = () => {
    setError(null);
    startTransition(async () => {
      const res = await availabilityAction({ phone, useFileAddress: fileAddress, zip: address.zip, pets });
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
      const res = await requestBookingAction({
        phone,
        pets,
        start,
        useFileAddress: fileAddress,
        ...address,
        ...contact,
        smsConsent: consent,
        agreed,
        signature,
      });
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
  const mustSign = !!agreement && !!who?.mustSign;

  return (
    <div className="space-y-6">
      <BreedOptions />
      {/* 1. Phone */}
      <section aria-labelledby="phone-h" className="space-y-3">
        <h2 id="phone-h" className="text-lg font-bold">1. Your mobile number</h2>
        <div className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Mobile phone</span>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(650) 555-0123"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (who) setWho(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && phone.replace(/\D/g, "").length >= 10 && lookup()}
            />
          </label>
          {!who && (
            <Button type="button" disabled={pending || phone.replace(/\D/g, "").length < 10} onClick={lookup}>
              {pending ? "…" : "Continue"}
            </Button>
          )}
        </div>
        {known && <Notice kind="success">Welcome back, {known.firstName}! 🐾</Notice>}
        {who && !who.known && <p className="text-sm text-muted">Welcome! It looks like your first visit with us.</p>}
      </section>

      {error && !who && <Notice kind="error">{error}</Notice>}

      {/* 2. Pets and services */}
      {who && (
        <section aria-labelledby="pets-h" className="space-y-3">
          <h2 id="pets-h" className="text-lg font-bold">2. Who are we grooming?</h2>
          {known?.pets.map((p) => {
            const c = choices[p.id] ?? { on: false, size: p.size ?? "", serviceIds: [] };
            const set = (patch: Partial<Choice>) => {
              setChoices({ ...choices, [p.id]: { ...c, ...patch } });
              resetTimes();
            };
            return (
              <fieldset key={p.id} className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
                <legend className="sr-only">{p.name}</legend>
                <label className="flex items-center gap-3">
                  <input type="checkbox" checked={c.on} onChange={(e) => set({ on: e.target.checked })} className="h-5 w-5" />
                  <span className="font-semibold">{p.name}</span>
                  {p.breed && <span className="text-sm text-muted">{p.breed}</span>}
                </label>
                {c.on && (
                  <PetChoices
                    services={services}
                    size={c.size}
                    sizeLocked={!!p.size}
                    serviceIds={c.serviceIds}
                    onSize={(size) => set({ size, serviceIds: [] })}
                    onServices={(serviceIds) => set({ serviceIds })}
                    groupName={p.id}
                  />
                )}
              </fieldset>
            );
          })}
          {newPets.map((pet, i) => {
            const update = (patch: Partial<PetRequest>) => {
              setNewPets(newPets.map((p, j) => (j === i ? { ...p, ...patch } : p)));
              resetTimes();
            };
            return (
              <fieldset key={i} className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
                <legend className="sr-only">New pet {i + 1}</legend>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Pet's name">
                    <Input value={pet.name} onChange={(e) => update({ name: e.target.value })} autoComplete="off" />
                  </Field>
                  <Field label="Breed">
                    <Input value={pet.breed} onChange={(e) => update({ breed: e.target.value })} autoComplete="off" list="dog-breeds" placeholder="Start typing…" />
                  </Field>
                </div>
                <PhotoPicker photo={pet.photo} onPhoto={(photo) => update({ photo })} />
                <PetChoices
                  services={services}
                  size={pet.size}
                  sizeLocked={false}
                  serviceIds={pet.serviceIds}
                  onSize={(size) => update({ size, serviceIds: [] })}
                  onServices={(serviceIds) => update({ serviceIds })}
                  groupName={`new-${i}`}
                />
                {(newPets.length > 1 || known) && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewPets(newPets.filter((_, j) => j !== i));
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
                setNewPets([...newPets, emptyPet()]);
                resetTimes();
              }}
            >
              {known ? "Add a new pet" : "Add another pet"}
            </Button>
          )}
        </section>
      )}

      {/* 3. Address */}
      {who && (
        <section aria-labelledby="where-h" className="space-y-3">
          <h2 id="where-h" className="text-lg font-bold">3. Where should we park the van?</h2>
          {known?.hasAddress && (
            <label className="flex items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <input
                type="checkbox"
                checked={useFileAddress}
                onChange={(e) => {
                  setUseFileAddress(e.target.checked);
                  resetTimes();
                }}
                className="mt-1 h-5 w-5"
              />
              <span>
                <span className="block font-medium">Same address as last time{known.city ? ` in ${known.city}` : ""}</span>
                <span className="block text-sm text-muted">Untick if we should go somewhere else this time.</span>
              </span>
            </label>
          )}
          {!fileAddress && (
            <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <Field label="Street address">
                <Input value={address.address} onChange={(e) => setAddress({ ...address, address: e.target.value })} autoComplete="street-address" />
              </Field>
              <div className="grid grid-cols-[1fr_7rem] gap-3">
                <Field label="City">
                  <Input value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} autoComplete="address-level2" />
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
          )}
          {!days && (
            <Button type="button" className="w-full" disabled={pending || !petsReady || !addressReady} onClick={findTimes}>
              {pending ? "Looking for times…" : "See available times"}
            </Button>
          )}
          {!petsReady && <p className="text-center text-xs text-muted">Choose a pet, its size and a service first.</p>}
        </section>
      )}

      {error && who && <Notice kind="error">{error}</Notice>}

      {/* 4. Time */}
      {days && days.length > 0 && (
        <section aria-labelledby="when-h" className="space-y-3">
          <h2 id="when-h" className="text-lg font-bold">4. Pick a time</h2>
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
          <p className="text-xs text-muted">The time is when we arrive. Your visit takes about {minutesLabel(minutes)}.</p>
        </section>
      )}

      {/* 5. Details */}
      {start && (
        <section aria-labelledby="you-h" className="space-y-3">
          <h2 id="you-h" className="text-lg font-bold">5. {known ? "Almost done" : "Your details"}</h2>
          <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
            {!known && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First name">
                    <Input value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} autoComplete="given-name" />
                  </Field>
                  <Field label="Last name">
                    <Input value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} autoComplete="family-name" />
                  </Field>
                </div>
                <Field label="Email">
                  <Input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" />
                </Field>
              </>
            )}
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
          {mustSign && (
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
            disabled={pending || (mustSign && (!agreed || signature.trim().length < 3))}
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

function PetChoices({
  services,
  size,
  sizeLocked,
  serviceIds,
  onSize,
  onServices,
  groupName,
}: {
  services: Service[];
  size: string;
  sizeLocked: boolean;
  serviceIds: string[];
  onSize: (size: string) => void;
  onServices: (ids: string[]) => void;
  groupName: string;
}) {
  const byId = new Map(services.map((s) => [s.id, s]));
  const mains = services.filter((s) => s.kind === "service" && (!s.size_class || s.size_class === size));
  const addons = services.filter((s) => s.kind === "addon");
  const main = serviceIds.find((id) => byId.get(id)?.kind === "service") ?? "";
  const extras = serviceIds.filter((id) => byId.get(id)?.kind === "addon");
  return (
    <div className="space-y-3">
      {sizeLocked ? (
        <p className="text-sm text-muted">Size: {SIZES.find((s) => s.value === size)?.label}</p>
      ) : (
        <div role="radiogroup" aria-label="Size" className="space-y-1">
          <p className="text-sm font-medium">Size</p>
          <p className="text-xs text-muted">Height from the floor to the top of the shoulders.</p>
          <div className="grid grid-cols-2 gap-2">
            {SIZES.map((s) => (
              <label
                key={s.value}
                className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${
                  size === s.value ? "border-brand bg-brand-soft font-semibold text-brand-strong" : "border-line"
                }`}
              >
                <input type="radio" name={`size-${groupName}`} value={s.value} checked={size === s.value} onChange={() => onSize(s.value)} className="sr-only" />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      )}
      {size && (
        <div role="radiogroup" aria-label="Service" className="space-y-2">
          <p className="text-sm font-medium">Service</p>
          {mains.map((s) => (
            <label
              key={s.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 ${main === s.id ? "border-brand bg-brand-soft" : "border-line"}`}
            >
              <input type="radio" name={`service-${groupName}`} checked={main === s.id} onChange={() => onServices([s.id, ...extras])} className="h-4 w-4" />
              <span className="flex-1">
                <span className="block font-medium">{s.category ?? s.name}</span>
                <span className="block text-xs text-muted">{s.name} · {minutesLabel(s.duration_min)}</span>
              </span>
              <span className="font-semibold">{money(s.price_cents)}</span>
            </label>
          ))}
          {addons.length > 0 && (
            <details className="rounded-xl border border-line px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">Extras{extras.length ? ` (${extras.length})` : ""}</summary>
              <ul className="mt-2 space-y-1">
                {addons.map((a) => (
                  <li key={a.id}>
                    <label className="flex items-center gap-3 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={extras.includes(a.id)}
                        onChange={(e) =>
                          onServices([...(main ? [main] : []), ...(e.target.checked ? [...extras, a.id] : extras.filter((x) => x !== a.id))])
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
    </div>
  );
}

function PhotoPicker({ photo, onPhoto }: { photo?: string; onPhoto: (dataUrl: string | undefined) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- local preview of the picked file
        <img src={photo} alt="Your pet" className="h-14 w-14 rounded-full object-cover" />
      ) : (
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-xl" aria-hidden>
          🐾
        </span>
      )}
      <label className="cursor-pointer rounded-xl border border-line px-3 py-2 text-sm font-semibold text-brand">
        {busy ? "Loading…" : photo ? "Change photo" : "Add a photo (optional)"}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              onPhoto(await blobToDataUrl(await resizeImage(file)));
            } catch {
              onPhoto(undefined);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
    </div>
  );
}
