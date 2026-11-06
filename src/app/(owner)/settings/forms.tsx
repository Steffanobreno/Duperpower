"use client";
import { msg } from "@/lib/i18n";
import { useRegion, useT } from "@/components/i18n";
import { FormPopup } from "@/components/popup";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { sizesFor, WEEKDAYS } from "@/lib/format";
import type { FormState } from "./actions";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

export type ServiceValues = {
  name: string;
  kind: "service" | "addon";
  category: string | null;
  size_class: string | null;
  duration_min: number;
  price_cents: number;
  description: string | null;
  active: boolean;
  online_bookable: boolean;
  color?: string | null;
};

export function ServiceForm({ action, initial, categories }: { action: Action; initial?: ServiceValues; categories: string[] }) {
  const { t } = useT();
  const { metric } = useRegion();
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <ActionForm action={formAction} className="space-y-4">
      <FormPopup state={state} />
      <Field label={t("Name")}>
        <Input name="name" defaultValue={initial?.name} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Type")}>
          <Select name="kind" defaultValue={initial?.kind ?? "service"}>
            <option value="service">{t("Service")}</option>
            <option value="addon">{t("Add-on")}</option>
          </Select>
        </Field>
        <Field label={t("Category")}>
          <Input name="category" defaultValue={initial?.category ?? ""} list="categories" placeholder={t("Bath")} />
          <datalist id="categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field label={t("Pet size")} hint={t("Leave as 'Any size' for services that cost the same for every dog.")}>
        <Select name="size_class" defaultValue={initial?.size_class ?? ""}>
          <option value="">{t("Any size")}</option>
          {sizesFor(metric).map((s) => (
            <option key={s.value} value={s.value}>
              {t(s.label)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Price ($)")}>
          <Input
            name="price"
            inputMode="decimal"
            defaultValue={initial ? (initial.price_cents / 100).toFixed(2) : ""}
            required
          />
        </Field>
        <Field label={t("Time (minutes)")} hint={t("0 for add-ons that take no extra time.")}>
          <Input name="duration_min" type="number" min={0} max={600} step={5} defaultValue={initial?.duration_min ?? 60} required />
        </Field>
      </div>
      <Field label={t("Description (optional)")}>
        <Textarea name="description" defaultValue={initial?.description ?? ""} />
      </Field>
      <Field label={t("Calendar color")} hint={t("Used when the calendar is colored by service.")}>
        <Input type="color" name="color" defaultValue={initial?.color ?? "#2563eb"} className="h-11 w-20 p-1" />
      </Field>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} className="h-4 w-4" />
        {t("Active (shows up when booking)")}
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="online_bookable" defaultChecked={initial?.online_bookable ?? true} className="h-4 w-4" />
        {t("Clients can book it online")}
      </label>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("Saving…") : t("Save")}
      </Button>
    </ActionForm>
  );
}

export function HoursForm({ action, hours, submitLabel }: { action: Action; hours: { weekday: number; start: string; end: string }[]; submitLabel?: string }) {
  const { t } = useT();
  const [state, formAction, pending] = useActionState(action, undefined);
  const byDay = new Map(hours.map((h) => [h.weekday, h]));
  // Monday first.
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <ActionForm action={formAction} className="space-y-3">
      <FormPopup state={state} savedText={t("Working hours saved.")} />
      {order.map((d) => {
        const h = byDay.get(d);
        return (
          <div key={d} className="grid grid-cols-[7.5rem_1fr_1fr] items-center gap-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name={`open:${d}`} defaultChecked={!!h} className="h-4 w-4" />
              {t(WEEKDAYS[d])}
            </label>
            <label>
              <span className="sr-only">{t("{d} start", { d: t(WEEKDAYS[d]) })}</span>
              <Input type="time" name={`start:${d}`} defaultValue={h?.start ?? "07:00"} step={900} />
            </label>
            <label>
              <span className="sr-only">{t("{d} end", { d: t(WEEKDAYS[d]) })}</span>
              <Input type="time" name={`end:${d}`} defaultValue={h?.end ?? "19:00"} step={900} />
            </label>
          </div>
        );
      })}
      <p className="text-xs text-muted">{t("Unchecked days are days off.")}</p>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("Saving…") : submitLabel ?? t("Save hours")}
      </Button>
    </ActionForm>
  );
}

/** A settings form whose fields are passed as children; shows "Saved" or the error. */
export function SimpleForm({
  action,
  children,
  submitLabel = msg("Save"),
  savedLabel = msg("Saved."),
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel?: string;
  savedLabel?: string;
}) {
  const { t } = useT();
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <ActionForm action={formAction} className="space-y-4">
      <FormPopup state={state} savedText={savedLabel} />
      {children}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("Saving…") : t(submitLabel)}
      </Button>
    </ActionForm>
  );
}
