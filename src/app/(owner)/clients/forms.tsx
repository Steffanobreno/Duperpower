"use client";
import { useRegion, useT } from "@/components/i18n";
import { FormPopup } from "@/components/popup";
import { DateField } from "@/components/date-field";
import { ActionForm } from "@/components/action-form";
import { useActionState, useState } from "react";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { sizesFor, weightOut } from "@/lib/format";
import { BreedOptions } from "@/components/breed-options";
import type { FormState } from "./actions";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

export type ClientValues = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  access_notes: string | null;
  sms_consent: boolean;
  referral_source?: string | null;
  tags?: string[];
};

/** Street (with Google suggestions when set up), city, state and ZIP, filled together when a suggestion is picked. */
function AddressFields({ initial }: { initial?: ClientValues }) {
  const { t } = useT();
  const { country } = useRegion();
  const us = country === "US";
  const [a, setA] = useState({
    street: initial?.address_line ?? "", unit: "", city: initial?.city ?? "", state: initial?.state ?? (us ? "CA" : ""), zip: initial?.zip ?? "",
  });
  const input = "block w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:border-brand focus:outline-none";
  return (
    <>
      <Field label={t("Street address")}>
        <AddressAutocomplete name="address_line" autoComplete="off" placeholder={t("123 Main St")} className={input}
          value={a.street} onChange={(street) => setA((x) => ({ ...x, street }))}
          onPick={(p) => setA((x) => ({ ...x, street: p.street, city: p.city, state: p.state || (us ? "CA" : ""), zip: p.zip }))} />
      </Field>
      <Field label={t("Apt, suite or unit (optional)")}>
        <Input name="address_unit" value={a.unit} onChange={(e) => setA({ ...a, unit: e.target.value.slice(0, 40) })} placeholder={t("Apt 4B")} autoComplete="off" />
      </Field>
      <div className="grid grid-cols-[1fr_5rem_6rem] gap-3">
        <Field label={t("City")}>
          <Input name="city" value={a.city} onChange={(e) => setA({ ...a, city: e.target.value })} />
        </Field>
        <Field label={us ? t("State") : t("State / region")}>
          <Input name="state" value={a.state} onChange={(e) => setA({ ...a, state: e.target.value })} maxLength={us ? 2 : 20} />
        </Field>
        <Field label={us ? "ZIP" : t("Postal code")}>
          <Input name="zip" inputMode={us ? "numeric" : "text"} value={a.zip} onChange={(e) => setA({ ...a, zip: e.target.value })} maxLength={10} />
        </Field>
      </div>
    </>
  );
}

/** The owner's lists from Settings → Client and pet options. */
export type ClientOptions = { tags: string[]; sources: string[] };
export type PetOptions = { coats: string[]; behaviors: string[]; breeds: string[] };

/** Checkboxes shown as chips, for picking tags. Keeps values that left the list but are still set. */
function ChipChecks({ name, legend, options, checked }: { name: string; legend: string; options: string[]; checked: string[] }) {
  const all = [...options, ...checked.filter((c) => !options.includes(c))];
  if (!all.length) return null;
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {all.map((o) => (
          <label key={o} className="cursor-pointer">
            <input type="checkbox" name={name} value={o} defaultChecked={checked.includes(o)} className="peer sr-only" />
            <span className="block rounded-full border border-line px-3 py-1.5 text-sm peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:font-semibold peer-checked:text-brand-strong peer-focus-visible:ring-2 peer-focus-visible:ring-brand">
              {o}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A select from a list that keeps the current value even when it is no longer on the list. */
function ListSelect({ name, options, value, empty }: { name: string; options: string[]; value: string | null | undefined; empty: string }) {
  const all = value && !options.includes(value) ? [...options, value] : options;
  return (
    <Select name={name} defaultValue={value ?? ""}>
      <option value="">{empty}</option>
      {all.map((o) => <option key={o} value={o}>{o}</option>)}
    </Select>
  );
}

export function ClientForm({ action, initial, submitLabel, options }: {
  action: Action; initial?: ClientValues; submitLabel: string; options: ClientOptions;
}) {
  const { t } = useT();
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <ActionForm action={formAction} className="space-y-4">
      <FormPopup state={state} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("First name")}>
          <Input name="first_name" defaultValue={initial?.first_name} required autoComplete="off" />
        </Field>
        <Field label={t("Last name")}>
          <Input name="last_name" defaultValue={initial?.last_name} autoComplete="off" />
        </Field>
      </div>
      <Field label={t("Mobile phone")} hint={t("Texts and reminders go to this number.")}>
        <Input name="phone" type="tel" inputMode="tel" defaultValue={initial?.phone} required placeholder="(650) 555-0123" />
      </Field>
      <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
        <input type="checkbox" name="sms_consent" defaultChecked={initial?.sms_consent ?? true} className="mt-1 h-4 w-4" />
        <span>{t("Client agreed to receive text messages about their appointments.")}</span>
      </label>
      <Field label={t("Email (optional)")}>
        <Input name="email" type="email" defaultValue={initial?.email ?? ""} />
      </Field>
      <AddressFields initial={initial} />
      <Field label={t("Parking and access notes")} hint={t("Gate code, where to park the van, water or power outlet.")}>
        <Textarea name="access_notes" defaultValue={initial?.access_notes ?? ""} />
      </Field>
      <Field label={t("How they found you")}>
        <ListSelect name="referral_source" options={options.sources} value={initial?.referral_source} empty={t("Not set")} />
      </Field>
      <ChipChecks name="tags" legend={t("Tags")} options={options.tags} checked={initial?.tags ?? []} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("Saving…") : submitLabel}
      </Button>
    </ActionForm>
  );
}

export type PetValues = {
  name: string;
  breed: string | null;
  size_class: string | null;
  weight_lbs: string | null;
  coat_type: string | null;
  birth_date: string | null;
  sex: string | null;
  behavior: string | null;
  behavior_tags?: string[];
  fixed?: boolean | null;
  vet_name: string | null;
  vet_phone: string | null;
  notes: string | null;
  rebook_every_days: number | null;
};

export function PetForm({
  action,
  initial,
  offerBooking,
  options,
}: {
  action: Action;
  initial?: PetValues;
  offerBooking?: boolean;
  options: PetOptions;
}) {
  const { t } = useT();
  const region = useRegion();
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <ActionForm action={formAction} className="space-y-4">
      <FormPopup state={state} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Pet name")}>
          <Input name="name" defaultValue={initial?.name} required autoComplete="off" />
        </Field>
        <Field label={t("Breed")}>
          <Input name="breed" defaultValue={initial?.breed ?? ""} list="dog-breeds" autoComplete="off" placeholder={t("Start typing…")} />
          <BreedOptions extra={options.breeds} />
        </Field>
      </div>
      <Field label={region.sizeBy === "weight" ? t("Size") : t("Size (height at the shoulder)")}
        hint={region.sizeBy === "weight" ? t("Comes from the weight when you type it. Picks the right price when booking.") : t("Picks the right price when booking.")}>
        <Select name="size_class" defaultValue={initial?.size_class ?? ""}>
          <option value="">{t("Not set")}</option>
          {sizesFor(region).map((s) => (
            <option key={s.value} value={s.value}>
              {t(s.label)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label={region.kg ? t("Weight (kg)") : t("Weight (lb)")}>
          <Input name="weight_lbs" inputMode="decimal" defaultValue={weightOut(initial?.weight_lbs, region.kg)} />
        </Field>
        <Field label={t("Sex")}>
          <Select name="sex" defaultValue={initial?.sex ?? ""}>
            <option value="">—</option>
            <option value="male">{t("Male")}</option>
            <option value="female">{t("Female")}</option>
          </Select>
        </Field>
        <Field label={t("Birthday")}>
          <DateField name="birth_date" defaultValue={initial?.birth_date ?? ""} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Coat")}>
          <ListSelect name="coat_type" options={options.coats} value={initial?.coat_type} empty={t("Not set")} />
        </Field>
        <Field label={t("Spayed / neutered")}>
          <Select name="fixed" defaultValue={initial?.fixed == null ? "" : initial.fixed ? "yes" : "no"}>
            <option value="">{t("Not set")}</option>
            <option value="yes">{t("Yes")}</option>
            <option value="no">{t("No")}</option>
          </Select>
        </Field>
      </div>
      <Field label={t("Groom every (days)")} hint={t("Used for the rebook reminder. Leave empty if unknown.")}>
        <Input name="rebook_every_days" inputMode="numeric" defaultValue={initial?.rebook_every_days ?? ""} placeholder="42" />
      </Field>
      <ChipChecks name="behavior_tags" legend={t("Behavior")} options={options.behaviors} checked={initial?.behavior_tags ?? []} />
      <Field label={t("Behavior notes")}>
        <Textarea name="behavior" defaultValue={initial?.behavior ?? ""} placeholder={t("Nervous with dryer, nips at paws…")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Vet")}>
          <Input name="vet_name" defaultValue={initial?.vet_name ?? ""} />
        </Field>
        <Field label={t("Vet phone")}>
          <Input name="vet_phone" type="tel" defaultValue={initial?.vet_phone ?? ""} />
        </Field>
      </div>
      <Field label={t("Grooming notes")}>
        <Textarea name="notes" defaultValue={initial?.notes ?? ""} placeholder="#7 blade body, scissor face…" />
      </Field>
      <div className="flex flex-col gap-2 sm:flex-row">
        {offerBooking && (
          <Button type="submit" name="then" value="book" disabled={pending} className="flex-1">
            {t("Save and book")}
          </Button>
        )}
        <Button type="submit" kind={offerBooking ? "secondary" : "primary"} disabled={pending} className="flex-1">
          {pending ? t("Saving…") : t("Save pet")}
        </Button>
      </div>
    </ActionForm>
  );
}
