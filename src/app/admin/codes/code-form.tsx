"use client";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { createCodeAction } from "./actions";

const input = "w-full rounded-xl border border-line bg-surface px-3 py-2";

// New discount code (the admin is in Portuguese only, so the texts are written here as they are).
export function CodeForm() {
  const [state, action, pending] = useActionState(createCodeAction, undefined);
  const [duration, setDuration] = useState("once");
  return (
    <ActionForm action={action} className="card grid gap-3 p-4 sm:grid-cols-2">
      <label className="space-y-1 text-sm font-medium">Código
        <input name="code" required placeholder="LANCAMENTO50" autoCapitalize="characters" className={`${input} uppercase`} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-sm font-medium">Tipo
          <select name="kind" className={input}><option value="percent">% de desconto</option><option value="amount">US$ de desconto</option></select>
        </label>
        <label className="space-y-1 text-sm font-medium">Valor
          <input name="value" required inputMode="decimal" placeholder="50" className={input} />
        </label>
      </div>
      <label className="space-y-1 text-sm font-medium">Vale por
        <select name="duration" value={duration} onChange={(e) => setDuration(e.target.value)} className={input}>
          <option value="once">Só a 1ª cobrança</option>
          <option value="repeating">Alguns meses</option>
          <option value="forever">Para sempre</option>
        </select>
      </label>
      {duration === "repeating" ? (
        <label className="space-y-1 text-sm font-medium">Quantos meses
          <input name="months" inputMode="numeric" required placeholder="3" className={input} />
        </label>
      ) : <span className="hidden sm:block" />}
      <label className="space-y-1 text-sm font-medium">Limite de usos (opcional)
        <input name="max" inputMode="numeric" placeholder="100" className={input} />
      </label>
      <label className="space-y-1 text-sm font-medium">Válido até (opcional)
        <input name="expires" type="date" className={input} />
      </label>
      <label className="space-y-1 text-sm font-medium sm:col-span-2">Anotação (só você vê)
        <input name="note" placeholder="Grupo de groomers do Facebook" className={input} />
      </label>
      {state?.error && <p role="alert" className="text-sm font-semibold text-danger sm:col-span-2">{state.error}</p>}
      {state?.saved && <p role="status" className="text-sm font-semibold text-success sm:col-span-2">Código criado.</p>}
      <button type="submit" disabled={pending} className="rounded-full bg-brand py-2.5 font-bold text-white sm:col-span-2">
        {pending ? "Criando…" : "Criar código"}
      </button>
    </ActionForm>
  );
}
