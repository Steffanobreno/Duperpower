"use client";
import { useT } from "@/components/i18n";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Messages as a window over the screen (instead of a line somewhere on the page):
// - an error: one button to close it;
// - a warning that can be overridden (an overlap, outside the hours): "Book anyway" sends the
//   form again with override=on, or close it to change something;
// - a confirmation ("Saved."): a small window that closes by itself.

const noop = () => () => {};
// A warning is only a question (the owner may well mean it): a calm clock, not an alarm.
const ICON = { error: "⛔", warn: "🕑", success: "✅" } as const;

export function Popup({ kind, title, children, onClose, actions, autoClose }: {
  kind: keyof typeof ICON; title?: string; children: ReactNode; onClose: () => void;
  actions?: ReactNode; autoClose?: number;
}) {
  const { t: tr } = useT();
  const closeBtn = useRef<HTMLButtonElement>(null);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const t = autoClose ? setTimeout(onClose, autoClose) : null;
    return () => {
      document.removeEventListener("keydown", onKey);
      if (t) clearTimeout(t);
    };
  }, [onClose, autoClose]);
  // Drawn only once the page is running in the browser (not in the HTML from the server).
  if (!mounted) return null;
  // A confirmation doesn't stop anything: a small window at the top that goes away by itself.
  if (kind === "success" && !actions) {
    return createPortal(
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+4.5rem)]">
        <div role="status" className="flex max-w-sm items-center gap-3 rounded-2xl bg-navy px-4 py-3 text-white shadow-2xl ring-1 ring-[#d4af37] animate-sheet">
          <span aria-hidden className="text-xl">{ICON.success}</span>
          <span className="text-[15px] font-semibold">{children}</span>
        </div>
      </div>,
      document.body,
    );
  }
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/50 p-6 animate-fade" onClick={onClose}>
      <div role={kind === "success" ? "status" : "alertdialog"} aria-modal="true" aria-label={title ?? (kind === "error" ? tr("Error") : kind === "warn" ? tr("Heads up") : tr("Done"))}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-3xl bg-surface p-5 text-center shadow-2xl ring-1 ring-[#d4af37]/60 animate-sheet">
        <div aria-hidden className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-2xl ${
          kind === "warn" ? "bg-[#f7efd4]" : "bg-navy ring-2 ring-[#d4af37]"}`}>{ICON[kind]}</div>
        {(title ?? (kind === "warn" ? "Just checking" : null)) && <p className="text-lg font-extrabold">{title ?? tr("Just checking")}</p>}
        <div className="text-[15px] leading-snug">{children}</div>
        <div className="space-y-2">
          {actions}
          <button ref={closeBtn} type="button" onClick={onClose}
            className={`w-full rounded-full py-3 font-bold ${actions ? "border border-line text-ink" : "bg-brand text-white"}`}>
            {actions ? (kind === "warn" ? tr("Change it") : tr("Close")) : tr("OK")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The result of a form, as a window: its error, its warning (with a button to go ahead anyway,
 * when `override` names the field the server checks), or its confirmation. Put it inside the
 * <form> and pass the action's state: every new result opens the window again, even with the
 * same text.
 */
export function FormPopup({ state, override, overrideLabel = "Go ahead anyway", savedText = "Saved." }: {
  state: { error?: string; warning?: string; saved?: boolean } | null | undefined;
  /** The form field that means "do it anyway" (e.g. "override"). */
  override?: string; overrideLabel?: string; savedText?: string;
}) {
  const { t: tr } = useT();
  const [open, setOpen] = useState(!!state);
  const [shown, setShown] = useState(state);
  if (state !== shown) {
    setShown(state);
    setOpen(!!state);
  }
  const field = useRef<HTMLInputElement>(null);
  // A new warning asks again: "anyway" is never carried over to the next try.
  useEffect(() => {
    if (field.current && state?.warning) field.current.value = "";
  }, [state]);
  const message = state?.error ?? state?.warning ?? (state?.saved ? savedText : null);
  const kind = state?.error ? "error" : state?.warning ? "warn" : "success";
  return (
    <>
      {override && <input ref={field} type="hidden" name={override} defaultValue="" />}
      {open && message && (
        <Popup kind={kind} onClose={() => setOpen(false)} autoClose={kind === "success" ? 3500 : undefined}
          actions={kind === "warn" && override ? (
            <button type="button" className="w-full rounded-full bg-brand py-3 font-bold text-white"
              onClick={() => {
                const form = field.current?.form;
                if (field.current) field.current.value = "on";
                setOpen(false);
                form?.requestSubmit();
              }}>
              {tr(overrideLabel)}
            </button>
          ) : undefined}>
          {tr(message)}
        </Popup>
      )}
    </>
  );
}
