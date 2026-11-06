"use client";
import { msg } from "@/lib/i18n";
import { useRegion, useT } from "@/components/i18n";
import { FormPopup } from "@/components/popup";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Field, Input, Textarea } from "@/components/ui";
import type { FormState } from "../actions";

const DAYS = [msg("Sun"), msg("Mon"), msg("Tue"), msg("Wed"), msg("Thu"), msg("Fri"), msg("Sat")];
export const AREA_COLORS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#db2777", "#ca8a04"];

export function AreaForm({ action, initial }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  initial?: { name: string; color: string; weekdays: number[]; places: string };
}) {
  const { t } = useT();
  const { country } = useRegion();
  const [state, formAction, pending] = useActionState(action, undefined);
  const [color, setColor] = useState(initial?.color ?? AREA_COLORS[0]);
  return (
    <ActionForm action={formAction} className="space-y-4">
      <FormPopup state={state} />
      <Field label={t("Area name")}><Input name="name" defaultValue={initial?.name} required placeholder={t("Peninsula")} maxLength={60} /></Field>
      {country === "US" ? (
        <Field label={t("ZIP codes or cities")} hint={t("Separate with commas. A city name adds all its ZIP codes.")}>
          <Textarea name="places" rows={4} defaultValue={initial?.places} placeholder={t("San Mateo, Burlingame, 94010, 94401")} required />
        </Field>
      ) : (
        <Field label={t("Postal codes")} hint={t("Separate with commas. The first part of a code covers all the codes that start with it.")}>
          <Textarea name="places" rows={4} defaultValue={initial?.places} required />
        </Field>
      )}
      <fieldset>
        <legend className="mb-1 text-sm font-medium">{t("Days you go there")}</legend>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <label key={d} className="cursor-pointer">
              <input type="checkbox" name={`day:${i}`} defaultChecked={initial ? initial.weekdays.includes(i) : i > 0} className="peer sr-only" />
              <span className="block rounded-full border border-line px-3 py-1.5 text-sm peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:font-semibold peer-checked:text-brand-strong peer-focus-visible:ring-2 peer-focus-visible:ring-brand">
                {t(d)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">{t("Color")}</legend>
        <input type="hidden" name="color" value={color} />
        <div className="flex flex-wrap gap-2">
          {AREA_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={t("Color {c}", { c })} aria-pressed={color === c}
              className={`h-8 w-8 rounded-full border-4 ${color === c ? "border-ink" : "border-white"} shadow`} style={{ background: c }} />
          ))}
        </div>
      </fieldset>
      <Button type="submit" disabled={pending} className="w-full">{pending ? t("Saving…") : t("Save area")}</Button>
    </ActionForm>
  );
}
