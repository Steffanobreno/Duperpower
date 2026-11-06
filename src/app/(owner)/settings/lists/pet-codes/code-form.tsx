"use client";
import { useT } from "@/components/i18n";
import { FormPopup } from "@/components/popup";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Field, Input, Notice } from "@/components/ui";
import type { FormState } from "../../actions";

export const CODE_COLORS = [
  "#dc2626", "#e11d48", "#db2777", "#c026d3", "#9333ea", "#7c3aed", "#4f46e5", "#2563eb",
  "#0284c7", "#0891b2", "#0d9488", "#059669", "#16a34a", "#65a30d", "#ca8a04", "#d97706",
  "#ea580c", "#92400e", "#57534e", "#334155",
];

/** Add or edit a pet code: a short label, a color and what it means. */
export function PetCodeForm({ action, initial, submitLabel, onDone }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  initial?: { label: string; color: string; description: string | null };
  submitLabel: string;
  onDone?: () => void;
}) {
  const { t } = useT();
  const [color, setColor] = useState(initial?.color ?? CODE_COLORS[0]);
  const [label, setLabel] = useState(initial?.label ?? "");
  const [state, formAction, pending] = useActionState(async (s: FormState, f: FormData) => {
    const r = await action(s, f);
    if (r?.saved) {
      if (!initial) setLabel("");
      onDone?.();
    }
    return r;
  }, undefined);
  return (
    <ActionForm action={formAction} className="space-y-3">
      <FormPopup state={state} />
      {state?.saved && !initial && <Notice kind="success">{t("Code added.")}</Notice>}
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <Field label={t("Code (up to 8 letters)")}>
          <Input name="label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={8} required placeholder={t("Matted")} />
        </Field>
        <span className="mb-2 rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ background: color }} aria-hidden>
          {label || t("Code")}
        </span>
      </div>
      <Field label={t("What it means (optional)")}>
        <Input name="description" defaultValue={initial?.description ?? ""} maxLength={120} placeholder={t("Coat is matted, needs a shave-down")} />
      </Field>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">{t("Color")}</legend>
        <div className="flex flex-wrap gap-2">
          {CODE_COLORS.map((c) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="color" value={c} checked={color === c} onChange={() => setColor(c)} className="peer sr-only" aria-label={c} />
              <span className="block h-8 w-8 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-brand"
                style={{ background: c }} />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">{pending ? t("Saving…") : submitLabel}</Button>
        {onDone && initial && <Button type="button" kind="secondary" onClick={onDone}>{t("Cancel")}</Button>}
      </div>
    </ActionForm>
  );
}
