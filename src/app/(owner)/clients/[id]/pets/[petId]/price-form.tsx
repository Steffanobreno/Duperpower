"use client";
import { useT } from "@/components/i18n";
import { FormPopup } from "@/components/popup";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Field, Input, Select } from "@/components/ui";
import { money } from "@/lib/format";
import type { FormState } from "../../../actions";

type Option = { id: string; name: string; price_cents: number; duration_min: number };

/** Sets the pet's own price (and optionally time) for one service. */
export function PetPriceForm({ action, petName, options }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  petName: string;
  options: Option[];
}) {
  const { t } = useT();
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <ActionForm action={formAction} className="space-y-3">
      <FormPopup state={state} />
      <Field label={t("Service")}>
        <Select name="service_id" required defaultValue="">
          <option value="" disabled>{t("Choose a service")}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{t("{name} · usually {money}", { name: o.name, money: money(o.price_cents) })}</option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`${petName}'s price`}>
          <Input name="price" inputMode="decimal" placeholder="$" required autoComplete="off" />
        </Field>
        <Field label={t("Time (optional)")}>
          <Input name="minutes" inputMode="numeric" placeholder={t("minutes")} autoComplete="off" />
        </Field>
      </div>
      <Button type="submit" kind="secondary" disabled={pending} className="w-full">{pending ? t("Saving…") : t("Save price")}</Button>
    </ActionForm>
  );
}
