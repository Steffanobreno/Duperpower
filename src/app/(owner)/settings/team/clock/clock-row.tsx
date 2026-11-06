"use client";
import { useT } from "@/components/i18n";
import { FormPopup } from "@/components/popup";
import { DateField } from "@/components/date-field";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Input } from "@/components/ui";
import { deleteClockEntryAction, saveClockEntryAction, type TeamState } from "../actions";

const label = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** One clock entry; tap to fix the times. */
export function ClockRow({ id, name, date, inT, outT }: { id: string; name: string; date: string; inT: string; outT: string }) {
  const { t: tr } = useT();
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (s: TeamState, f: FormData) => {
    const r = await saveClockEntryAction(id, s, f);
    if (r?.saved) setEditing(false);
    return r;
  }, undefined);
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  if (!editing) {
    return (
      <li>
        <button type="button" onClick={() => setEditing(true)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-bg"
          aria-label={`Edit ${name} on ${day}`}>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{name}</span>
            <span className="block text-sm text-muted">{day} · {label(inT)} – {outT ? label(outT) : tr("still in")}</span>
          </span>
          {outT && <span className="text-sm font-semibold">{((Number(outT.slice(0, 2)) * 60 + Number(outT.slice(3)) - Number(inT.slice(0, 2)) * 60 - Number(inT.slice(3))) / 60).toFixed(1)} h</span>}
        </button>
      </li>
    );
  }
  return (
    <li className="space-y-2 px-4 py-3">
      <p className="font-semibold">{name}</p>
      <FormPopup state={state} />
      <ActionForm action={action} className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <DateField name="date" defaultValue={date} label={tr("Day")} />
          <Input type="time" name="in" defaultValue={inT} aria-label={tr("Clock in")} />
          <Input type="time" name="out" defaultValue={outT} aria-label={tr("Clock out")} />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending} className="flex-1">{tr("Save")}</Button>
          <Button type="button" kind="secondary" onClick={() => setEditing(false)}>{tr("Cancel")}</Button>
          <Button type="button" kind="danger" onClick={() => { if (window.confirm("Delete this entry?")) deleteClockEntryAction(id); }}>{tr("Delete")}</Button>
        </div>
      </ActionForm>
    </li>
  );
}
