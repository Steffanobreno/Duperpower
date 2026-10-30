"use client";
import { useState } from "react";
import type { FormState } from "../../actions";
import { PetCodeForm } from "./code-form";

/** A pet code in the list: tap to edit; move and remove buttons. */
export function PetCodeRow({ code, save, move, remove, first, last }: {
  code: { label: string; color: string; description: string | null };
  save: (s: FormState, f: FormData) => Promise<FormState>;
  move: (d: "up" | "down") => Promise<void>;
  remove: () => Promise<void>;
  first: boolean; last: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const icon = "rounded-lg px-2 py-1 text-sm font-semibold hover:bg-bg disabled:opacity-30";
  if (editing) return <li className="px-4 py-3"><PetCodeForm action={save} initial={code} submitLabel="Save code" onDone={() => setEditing(false)} /></li>;
  return (
    <li className="flex items-center gap-2 px-4 py-2.5">
      <button type="button" onClick={() => setEditing(true)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label={`Edit ${code.label}`}>
        <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: code.color }}>{code.label}</span>
        <span className="truncate text-sm text-muted">{code.description}</span>
      </button>
      <button type="button" className={icon} disabled={first} onClick={() => move("up")} aria-label={`Move ${code.label} up`}>↑</button>
      <button type="button" className={icon} disabled={last} onClick={() => move("down")} aria-label={`Move ${code.label} down`}>↓</button>
      <button type="button" className={`${icon} text-danger`} aria-label={`Remove ${code.label}`}
        onClick={() => { if (window.confirm(`Remove the “${code.label}” code from every pet?`)) remove(); }}>
        Remove
      </button>
    </li>
  );
}
