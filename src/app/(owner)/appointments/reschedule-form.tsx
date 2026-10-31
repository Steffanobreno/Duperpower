"use client";
import { DateField } from "@/components/date-field";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Field, Input, Notice } from "@/components/ui";
import type { FormState } from "./actions";

export function RescheduleForm({
  action,
  date,
  time,
  notify = true,
  primary = false,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  date: string;
  time: string;
  /** Offer to text the client the new time (not for a visit already done). */
  notify?: boolean;
  /** The main action on the screen (after picking a time on the calendar). */
  primary?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <ActionForm action={formAction} className="space-y-3">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="New date">
          <DateField name="date" defaultValue={date} required />
        </Field>
        <Field label="New time">
          <Input type="time" name="time" defaultValue={time} step={900} required />
        </Field>
      </div>
      {notify && (
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="notify" defaultChecked className="h-4 w-4" />
          Tell the client about the new time
        </label>
      )}
      {state?.warning && (
        <div className="space-y-2">
          <Notice kind="warn">{state.warning}</Notice>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="override" className="h-4 w-4" />
            Move it anyway
          </label>
        </div>
      )}
      <Button type="submit" kind={primary ? "primary" : "secondary"} disabled={pending} className={primary ? "w-full py-3.5 text-base" : undefined}>
        {pending ? "Moving…" : "Move appointment"}
      </Button>
    </ActionForm>
  );
}
