"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/components/ui";
import { Close, Plus } from "@/components/icons";
import { minutesLabel, money } from "@/lib/format";
import { saveServicesAction, type VisitPet } from "../../actions";

type Line = { key: string; id?: string; serviceId: string; name: string; priceCents: number; minutes: number; keepForPet?: boolean };
type Pet = {
  appointmentPetId?: string;
  petId: string;
  name: string;
  breed?: string | null;
  size: string | null;
  lines: Omit<Line, "key">[];
  /** This pet's own prices: service id → price and (optionally) time. */
  ownPrices?: Record<string, { priceCents: number; minutes: number | null }>;
};
type CatalogItem = { id: string; name: string; kind: "service" | "addon"; size: string | null; priceCents: number; minutes: number };
type PetState = Omit<Pet, "lines"> & { lines: Line[] };

let nextKey = 0;
const STEP = 15;
const withKeys = (p: Pet): PetState => ({ ...p, lines: p.lines.map((l) => ({ ...l, key: `k${nextKey++}` })) });

// The pets and services of one visit: change a service for another, its price and time (and keep
// that price for the pet's next visits), add or remove a service, add or remove a pet.
// Time changes move the visit's end.
export function ServicesEditor({
  appointmentId, startIso, timezone, pets, otherPets = [], catalog, canKeepPrices = true,
}: {
  appointmentId: string; startIso: string; timezone: string; pets: Pet[]; otherPets?: Pet[]; catalog: CatalogItem[];
  canKeepPrices?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<PetState[]>(() => pets.map(withKeys));
  const [result, setResult] = useState<{ error?: string; warning?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const all = state.flatMap((p) => p.lines);
  const totalMin = all.reduce((s, l) => s + l.minutes, 0);
  const total = all.reduce((s, l) => s + l.priceCents, 0);
  const start = new Date(startIso);
  const end = new Date(start.getTime() + Math.max(totalMin, 15) * 60_000);
  const time = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone });
  const setPet = (petId: string, f: (p: PetState) => PetState) => setState(state.map((p) => (p.petId === petId ? f(p) : p)));
  const update = (petId: string, key: string, patch: Partial<Line>) =>
    setPet(petId, (p) => ({ ...p, lines: p.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  const addable = otherPets.filter((o) => !state.some((p) => p.petId === o.petId));

  // The catalog as this pet gets it: its size, and its own price and time when it has one.
  const optionsFor = (p: PetState) => catalog.filter((c) => !c.size || !p.size || c.size === p.size).map((c) => {
    const own = p.ownPrices?.[c.id];
    return own ? { ...c, priceCents: own.priceCents, minutes: own.minutes ?? c.minutes } : c;
  });
  // What the pet pays for this service without changing anything (its own price, or the menu's).
  const usual = (p: PetState, serviceId: string) => optionsFor(p).find((c) => c.id === serviceId) ?? catalog.find((c) => c.id === serviceId);

  const save = () =>
    startTransition(async () => {
      const payload: VisitPet[] = state.map((p) => ({
        appointmentPetId: p.appointmentPetId,
        petId: p.petId,
        lines: p.lines.map((l) => ({ id: l.id, serviceId: l.serviceId, priceCents: l.priceCents, minutes: l.minutes, keepForPet: !!l.keepForPet })),
      }));
      const res = await saveServicesAction(appointmentId, payload);
      if (res?.error) return setResult(res);
      if (res?.warning) {
        setResult(res);
        router.refresh();
        return;
      }
      router.push(`/appointments/${appointmentId}`);
    });

  return (
    <div className="space-y-5">
      {state.map((p) => {
        const options = optionsFor(p);
        return (
          <section key={p.petId} className="space-y-2" aria-label={p.name}>
            <div className="flex items-center justify-between px-1">
              <h2 className="section-label px-0">{p.name}</h2>
              {state.length > 1 && (
                <button type="button" onClick={() => setState(state.filter((x) => x.petId !== p.petId))}
                  className="text-sm font-semibold text-danger">Remove {p.name}</button>
              )}
            </div>
            {p.lines.length === 0 && <p className="px-1 text-sm text-muted">Pick {p.name}&apos;s service below.</p>}
            {p.lines.map((l) => {
              const normal = usual(p, l.serviceId);
              const custom = !!normal && (l.priceCents !== normal.priceCents || l.minutes !== normal.minutes);
              return (
                <div key={l.key} className="card divide-y divide-line">
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Change the service for another (keeps the line; price and time follow the new one). */}
                    <select aria-label={`Change ${l.name}`} value={l.serviceId}
                      className="w-0 min-w-0 flex-1 appearance-none truncate bg-transparent font-semibold outline-none"
                      onChange={(e) => {
                        const c = options.find((x) => x.id === e.target.value) ?? catalog.find((x) => x.id === e.target.value);
                        if (c) update(p.petId, l.key, { serviceId: c.id, name: c.name, priceCents: c.priceCents, minutes: c.minutes, keepForPet: false });
                      }}>
                      {!options.some((c) => c.id === l.serviceId) && <option value={l.serviceId}>{l.name}</option>}
                      {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <span aria-hidden className="text-xs font-semibold text-brand">Change ▾</span>
                    <button type="button" aria-label={`Remove ${l.name}`} disabled={p.lines.length === 1 && state.length === 1}
                      onClick={() => setPet(p.petId, (x) => ({ ...x, lines: x.lines.filter((y) => y.key !== l.key) }))}
                      className="rounded-full border-2 border-danger p-0.5 text-danger disabled:opacity-30">
                      <Close size={14} strokeWidth={3} />
                    </button>
                  </div>
                  <label className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-muted">Price</span>
                    <span className="flex items-center gap-1">
                      $
                      <input key={`${l.key}:${l.serviceId}`} inputMode="decimal" aria-label={`Price of ${l.name}`}
                        className="w-24 rounded-lg border border-line px-2 py-1.5 text-right"
                        defaultValue={(l.priceCents / 100).toString()}
                        onChange={(e) => {
                          const n = Math.round(Number(e.target.value.replace(/[$,]/g, "")) * 100);
                          if (Number.isFinite(n) && n >= 0) update(p.petId, l.key, { priceCents: n });
                        }} />
                    </span>
                  </label>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-muted">Time</span>
                    <span className="flex items-center gap-3">
                      <button type="button" aria-label={`Less time for ${l.name}`} className="stepper"
                        onClick={() => update(p.petId, l.key, { minutes: Math.max(0, l.minutes - STEP) })}>−</button>
                      <span className="w-20 text-center font-semibold tabular-nums" aria-live="polite">{l.minutes} min</span>
                      <button type="button" aria-label={`More time for ${l.name}`} className="stepper"
                        onClick={() => update(p.petId, l.key, { minutes: Math.min(720, l.minutes + STEP) })}>+</button>
                    </span>
                  </div>
                  {custom && normal && canKeepPrices && (
                    <label className="flex items-start gap-3 bg-brand-soft/60 px-4 py-3 text-sm">
                      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#12305a]" checked={!!l.keepForPet}
                        onChange={(e) => update(p.petId, l.key, { keepForPet: e.target.checked })} />
                      <span>
                        <span className="block font-semibold">Keep {money(l.priceCents)}{l.minutes !== normal.minutes ? ` · ${l.minutes} min` : ""} for {p.name} on future visits</span>
                        <span className="text-muted">Usually {money(normal.priceCents)} · {normal.minutes} min</span>
                      </span>
                    </label>
                  )}
                </div>
              );
            })}
            <label className="card flex items-center gap-3 px-4 py-3 text-brand">
              <Plus size={18} />
              <select aria-label={`Add a service for ${p.name}`} className="w-0 min-w-0 flex-1 truncate bg-transparent font-semibold outline-none" value=""
                onChange={(e) => {
                  const c = options.find((x) => x.id === e.target.value);
                  if (!c) return;
                  setPet(p.petId, (x) => ({ ...x, lines: [...x.lines, { key: `k${nextKey++}`, serviceId: c.id, name: c.name, priceCents: c.priceCents, minutes: c.minutes }] }));
                }}>
                <option value="">Add a service</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} · {money(c.priceCents)}</option>
                ))}
              </select>
            </label>
          </section>
        );
      })}

      {addable.length > 0 && (
        <label className="card flex items-center gap-3 border-dashed px-4 py-3 text-brand">
          <Plus size={18} />
          <select aria-label="Add a pet" className="w-0 min-w-0 flex-1 truncate bg-transparent font-semibold outline-none" value=""
            onChange={(e) => {
              const o = addable.find((x) => x.petId === e.target.value);
              if (o) setState([...state, withKeys(o)]);
            }}>
            <option value="">Add a pet to this visit</option>
            {addable.map((o) => <option key={o.petId} value={o.petId}>{o.name}{o.breed ? ` · ${o.breed}` : ""}</option>)}
          </select>
        </label>
      )}

      <div className="card space-y-1 px-4 py-3">
        <p className="flex justify-between"><span className="text-muted">Total time</span><span className="font-semibold">{minutesLabel(totalMin)}</span></p>
        <p className="flex justify-between"><span className="text-muted">Visit</span><span className="font-semibold">{time(start)} – {time(end)}</span></p>
        <p className="flex justify-between text-lg font-bold"><span>Total</span><span>{money(total)}</span></p>
      </div>
      {result?.error && <Notice kind="error">{result.error}</Notice>}
      {result?.warning && <Notice kind="warn">{result.warning}</Notice>}
      <Button className="w-full py-3.5 text-base" disabled={pending || state.some((p) => p.lines.length === 0)} onClick={save}>
        {pending ? "Saving…" : state.some((p) => p.lines.length === 0) ? "Pick a service for each pet" : "Save changes"}
      </Button>
    </div>
  );
}
