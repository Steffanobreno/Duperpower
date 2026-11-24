"use client";
import { useState, useTransition } from "react";
import { useT } from "@/components/i18n";

/** "Remove {pet} from this visit", asked once more before it happens. */
export function RemovePetButton({ name, remove }: { name: string; remove: () => Promise<void> }) {
  const { t } = useT();
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="text-sm font-semibold text-danger">
        {t("Remove {name} from this visit", { name })}
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={() => start(() => remove())}
        className="rounded-lg bg-danger px-3 py-1.5 text-sm font-bold text-white">
        {pending ? t("Removing…") : t("Yes, remove {name}", { name })}
      </button>
      <button type="button" onClick={() => setAsking(false)} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold">
        {t("Keep")}
      </button>
    </span>
  );
}
