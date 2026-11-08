"use client";
import { useState, useTransition } from "react";
import { emailReportCard } from "../report-actions";

/** "Send by email" for the report card; the error (if any) shows under the button. */
export function EmailReportButton({ appointmentId, label, disabledReason, errors }: {
  appointmentId: string;
  label: string;
  disabledReason: string | null; // already translated; the button is off when set
  errors: Record<string, string>; // the action's English errors, translated
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="col-span-2 space-y-1">
      <button type="button" disabled={pending || !!disabledReason} aria-describedby={disabledReason ? `rc-${appointmentId}` : undefined}
        onClick={() => start(async () => {
          const r = await emailReportCard(appointmentId);
          setError("error" in r ? (errors[r.error] ?? r.error) : null);
        })}
        className="w-full rounded-full border-2 border-brand py-2.5 text-brand disabled:opacity-50">
        {label}
      </button>
      {disabledReason && <p id={`rc-${appointmentId}`} className="text-center text-xs text-muted">{disabledReason}</p>}
      {error && <p role="alert" className="text-center text-xs text-danger">{error}</p>}
    </div>
  );
}
