"use client";
import { useId, useRef, useState, type ComponentProps } from "react";
import { addressSuggestionsAction, pickAddressAction } from "@/app/address-actions";
import type { PickedAddress, Suggestion } from "@/lib/maps";
import { useRegion } from "./i18n";

/**
 * A street address input that suggests full addresses while typing (Google Places, through
 * the server). Picking one fills street, city and ZIP via `onPick`. Without the Google key the
 * server returns no suggestions and this is a plain input.
 */
export function AddressAutocomplete({ value, onChange, onPick, className, ...props }: Omit<ComponentProps<"input">, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
  onPick: (a: PickedAddress) => void;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const token = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef("");
  const listId = useId();
  const { country } = useRegion();

  // Asks the server a moment after typing stops; answers to older text are dropped.
  const type = (v: string) => {
    onChange(v);
    latest.current = v;
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 4) {
      setItems([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      token.current ??= crypto.randomUUID();
      const found = await addressSuggestionsAction(v, token.current, country);
      if (latest.current !== v) return;
      setItems(found);
      setActive(-1);
      setOpen(found.length > 0);
    }, 300);
  };

  const pick = async (s: Suggestion) => {
    setOpen(false);
    latest.current = s.main;
    onChange(s.main);
    const a = await pickAddressAction(s.id, token.current ?? crypto.randomUUID());
    token.current = null; // a new session for the next address
    if (a) onPick(a);
  };

  return (
    <div className="relative">
      <input
        {...props}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className={className}
        value={value}
        onChange={(e) => type(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => items.length && setOpen(true)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(items[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          {items.map((s, i) => (
            <li key={s.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              className={`cursor-pointer px-3 py-2.5 text-left ${i === active ? "bg-brand-soft" : "hover:bg-bg"}`}>
              <span className="block text-sm font-semibold text-ink">{s.main}</span>
              <span className="block text-xs text-muted">{s.rest}</span>
            </li>
          ))}
          <li aria-hidden className="px-3 py-1 text-right text-[10px] text-muted">powered by Google</li>
        </ul>
      )}
    </div>
  );
}
