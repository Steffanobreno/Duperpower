"use client";
import { useT } from "@/components/i18n";
import { FormPopup } from "@/components/popup";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Notice } from "@/components/ui";
import { importClientsAction } from "./actions";

export function ImportForm() {
  const { t } = useT();
  const [state, action, pending] = useActionState(importClientsAction, undefined);
  const r = state?.report;
  return (
    <div className="space-y-4">
      <ActionForm action={action} className="space-y-4">
        <FormPopup state={state} />
        <label className="block space-y-1">
          <span className="text-sm font-medium">{t("Client export (.csv)")}</span>
          <input type="file" name="file" accept=".csv,text/csv" required className="block w-full text-sm" />
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="appointments" defaultChecked className="mt-1 h-4 w-4" />
          <span>{t("Also bring each client's next upcoming visit (you add the services later).")}</span>
        </label>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t("Importing… this can take a minute") : t("Import clients")}
        </Button>
      </ActionForm>
      {r && (
        <div className="space-y-2">
          <Notice kind="success">
            {t("{created} clients and {pets} pets imported, {appointments} upcoming visits.", { created: r.created, pets: r.pets, appointments: r.appointments })}
            {r.existing > 0 && t(" {existing} were already here and were left as they are.", { existing: r.existing })}
          </Notice>
          {r.moreUpcoming.length > 0 && (
            <Notice kind="warn">
              {t("Only the next visit came over for: {join}. Add their later visits by hand.", { join: r.moreUpcoming.join(", ") })}
            </Notice>
          )}
          {[...r.skipped, ...r.problems].length > 0 && (
            <details className="rounded-xl border border-line bg-surface p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                {r.skipped.length + r.problems.length} {" "}{t("rows need a look")}
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {[...r.skipped, ...r.problems].map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
