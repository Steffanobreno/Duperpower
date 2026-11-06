"use client";
import { useT } from "@/components/i18n";
import { FormPopup } from "@/components/popup";
import { DateField } from "@/components/date-field";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Field, Input } from "@/components/ui";
import type { FormState } from "../../../actions";

export function VaccineForm({ action, names }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  names: string[];
}) {
  const { t } = useT();
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <ActionForm action={formAction} className="space-y-3">
      <FormPopup state={state} />
      <Field label={t("Vaccine")}>
        <Input name="name" list="vaccine-names" placeholder={t("Rabies")} required autoComplete="off" />
        <datalist id="vaccine-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Expires")}><DateField name="expires_on" required /></Field>
        <Field label={t("Given (optional)")}><DateField name="given_on" /></Field>
      </div>
      <Button type="submit" kind="secondary" disabled={pending} className="w-full">{pending ? t("Saving…") : t("Add vaccine")}</Button>
    </ActionForm>
  );
}
