"use client";
import { ActionForm } from "@/components/action-form";
import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { minutesLabel, money, sizeLabel } from "@/lib/format";
import type { FormState } from "./actions";

type Pet = { id: string; name: string; breed: string | null; size_class: string | null };
type Service = {
  id: string;
  name: string;
  kind: "service" | "addon";
  category: string | null;
  size_class: string | null;
  duration_min: number;
  price_cents: number;
};

export function BookingForm({
  action,
  pets,
  services,
  defaultDate,
  defaultTime,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  pets: Pet[];
  services: Service[];
  defaultDate: string;
  defaultTime: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [chosen, setChosen] = useState<Record<string, boolean>>(() =>
    pets.length === 1 ? { [pets[0].id]: true } : {},
  );
  const [main, setMain] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<Record<string, string[]>>({});

  const mains = services.filter((s) => s.kind === "service");
  const addons = services.filter((s) => s.kind === "addon");
  const byId = new Map(services.map((s) => [s.id, s]));

  let minutes = 0;
  let cents = 0;
  for (const pet of pets) {
    if (!chosen[pet.id]) continue;
    for (const id of [main[pet.id], ...(extras[pet.id] ?? [])]) {
      const s = id ? byId.get(id) : undefined;
      if (s) {
        minutes += s.duration_min;
        cents += s.price_cents;
      }
    }
  }

  return (
    <ActionForm action={formAction} className="space-y-4">
      {state?.error && <Notice kind="error">{state.error}</Notice>}

      {pets.map((pet) => {
        const on = !!chosen[pet.id];
        // Services for this pet's size first, then the rest.
        const fits = mains.filter((s) => !s.size_class || s.size_class === pet.size_class);
        const others = mains.filter((s) => s.size_class && s.size_class !== pet.size_class);
        return (
          <fieldset key={pet.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <legend className="sr-only">{pet.name}</legend>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="pet"
                value={pet.id}
                checked={on}
                onChange={(e) => setChosen({ ...chosen, [pet.id]: e.target.checked })}
                className="h-5 w-5"
              />
              <span className="font-semibold">{pet.name}</span>
              <span className="text-sm text-muted">{[pet.breed, sizeLabel(pet.size_class)].filter(Boolean).join(" · ")}</span>
            </label>
            {on && (
              <div className="mt-3 space-y-3">
                <Field label="Service">
                  <Select
                    name={`svc:${pet.id}`}
                    required
                    value={main[pet.id] ?? ""}
                    onChange={(e) => setMain({ ...main, [pet.id]: e.target.value })}
                  >
                    <option value="" disabled>
                      Choose a service
                    </option>
                    <optgroup label={pet.size_class ? `For ${sizeLabel(pet.size_class)}` : "Services"}>
                      {fits.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — {money(s.price_cents)} · {minutesLabel(s.duration_min)}
                        </option>
                      ))}
                    </optgroup>
                    {others.length > 0 && (
                      <optgroup label="Other sizes">
                        {others.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} — {money(s.price_cents)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </Select>
                </Field>
                {addons.length > 0 && (
                  <details className="rounded-xl border border-line px-3 py-2" open={(extras[pet.id]?.length ?? 0) > 0}>
                    <summary className="cursor-pointer text-sm font-medium">
                      Add-ons{extras[pet.id]?.length ? ` (${extras[pet.id].length})` : ""}
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {addons.map((a) => {
                        const list = extras[pet.id] ?? [];
                        return (
                          <li key={a.id}>
                            <label className="flex items-center gap-3 py-1 text-sm">
                              <input
                                type="checkbox"
                                name={`svc:${pet.id}`}
                                value={a.id}
                                checked={list.includes(a.id)}
                                onChange={(e) =>
                                  setExtras({
                                    ...extras,
                                    [pet.id]: e.target.checked ? [...list, a.id] : list.filter((x) => x !== a.id),
                                  })
                                }
                                className="h-4 w-4"
                              />
                              <span className="flex-1">{a.name}</span>
                              <span className="text-muted">{money(a.price_cents)}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </fieldset>
        );
      })}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input type="date" name="date" defaultValue={defaultDate} required />
        </Field>
        <Field label="Start time">
          <Input type="time" name="time" defaultValue={defaultTime} step={900} required />
        </Field>
      </div>
      <Field label="Notes for this visit (optional)">
        <Textarea name="notes" />
      </Field>

      <div className="flex items-center justify-between rounded-xl bg-brand-soft px-4 py-3 text-brand-strong">
        <span>{minutes > 0 ? minutesLabel(minutes) : "No services yet"}</span>
        <span className="text-lg font-bold">{money(cents)}</span>
      </div>

      {state?.warning && (
        <div className="space-y-2">
          <Notice kind="warn">{state.warning}</Notice>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="override" className="h-4 w-4" />
            Book anyway
          </label>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Booking…" : "Book appointment"}
      </Button>
    </ActionForm>
  );
}
