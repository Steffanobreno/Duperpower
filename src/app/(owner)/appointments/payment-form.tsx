"use client";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Field, Input, Notice } from "@/components/ui";
import { money } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import type { FormState } from "./actions";

const TIP_PERCENTS = [15, 18, 20, 25];

export function PaymentForm({
  action,
  balanceCents,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  balanceCents: number;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [method, setMethod] = useState<string>("");
  const [amount, setAmount] = useState((balanceCents / 100).toFixed(2));
  const [tip, setTip] = useState("");
  const tipCents = Math.round(Number(tip || 0) * 100) || 0;
  const amountCents = Math.round(Number(amount || 0) * 100) || 0;

  return (
    <ActionForm action={formAction} className="space-y-4">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      <fieldset>
        <legend className="mb-1 text-sm font-medium">How did they pay?</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {PAYMENT_METHODS.map((m) => (
            <label
              key={m.value}
              className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-semibold ${
                method === m.value ? "border-brand bg-brand text-on-brand" : "border-line bg-surface"
              }`}
            >
              <input
                type="radio"
                name="method"
                value={m.value}
                checked={method === m.value}
                onChange={() => setMethod(m.value)}
                className="sr-only"
                required
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount for the service ($)">
          <Input name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Tip ($)">
          <Input name="tip" inputMode="decimal" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="0.00" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Quick tip">
        {TIP_PERCENTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setTip(((balanceCents * p) / 10000).toFixed(2))}
            className="rounded-full border border-line bg-surface px-3 py-1 text-sm"
          >
            {p}% · {money(Math.round((balanceCents * p) / 100))}
          </button>
        ))}
        <button type="button" onClick={() => setTip("")} className="rounded-full border border-line bg-surface px-3 py-1 text-sm">
          No tip
        </button>
      </div>
      <Field label="Reference (optional)" hint="Check number, or the Zelle/Venmo name or note.">
        <Input name="reference" autoComplete="off" />
      </Field>
      <Button type="submit" className="w-full" disabled={pending || !method}>
        {pending ? "Saving…" : `Record ${money(amountCents + tipCents)}`}
      </Button>
    </ActionForm>
  );
}
