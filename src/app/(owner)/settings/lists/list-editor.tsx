"use client";
import { useT } from "@/components/i18n";
import { FormPopup } from "@/components/popup";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Input } from "@/components/ui";
import type { FormState } from "../actions";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

/** Add an item to a list. */
export function AddOption({ action, placeholder }: { action: Action; placeholder: string }) {
  const { t } = useT();
  // A new key after each add empties the box for the next one.
  const [added, setAdded] = useState(0);
  const [state, formAction, pending] = useActionState(async (s: FormState, f: FormData) => {
    const r = await action(s, f);
    if (r?.saved) setAdded((n) => n + 1);
    return r;
  }, undefined);
  return (
    <ActionForm action={formAction} className="space-y-2" key={added}>
      <FormPopup state={state} />
      <div className="flex gap-2">
        <Input name="label" placeholder={placeholder} required maxLength={60} aria-label={t("New item")} className="flex-1" />
        <Button type="submit" disabled={pending}>{pending ? t("Adding…") : t("Add")}</Button>
      </div>
    </ActionForm>
  );
}

/** One list item: its name, a rename box when tapped, and move/remove buttons. */
export function OptionRow({ label, rename, move, remove, first, last }: {
  label: string; rename: Action; move: (d: "up" | "down") => Promise<void>; remove: () => Promise<void>;
  first: boolean; last: boolean;
}) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(async (s: FormState, f: FormData) => {
    const r = await rename(s, f);
    if (r?.saved) setEditing(false);
    return r;
  }, undefined);
  const icon = "rounded-lg px-2 py-1 text-sm font-semibold hover:bg-bg disabled:opacity-30";
  if (editing) {
    return (
      <li className="space-y-2 px-4 py-3">
        <FormPopup state={state} />
        <ActionForm action={formAction} className="flex gap-2">
          <Input name="label" defaultValue={label} required maxLength={60} aria-label={t("New name for {label}", { label })} className="flex-1" autoFocus />
          <Button type="submit" disabled={pending}>{t("Save")}</Button>
          <Button type="button" kind="ghost" onClick={() => setEditing(false)}>{t("Cancel")}</Button>
        </ActionForm>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-1 px-4 py-2">
      <button type="button" onClick={() => setEditing(true)} className="min-w-0 flex-1 truncate py-1 text-left font-medium"
        aria-label={t("Rename {label}", { label })}>
        {label}
      </button>
      <button type="button" className={icon} disabled={first} onClick={() => move("up")} aria-label={t("Move {label} up", { label })}>↑</button>
      <button type="button" className={icon} disabled={last} onClick={() => move("down")} aria-label={t("Move {label} down", { label })}>↓</button>
      <button type="button" className={`${icon} text-danger`} aria-label={t("Remove {label}", { label })}
        onClick={() => { if (window.confirm(t("Remove “{label}” from the list?", { label }))) remove(); }}>
        {t("Remove")}
      </button>
    </li>
  );
}
