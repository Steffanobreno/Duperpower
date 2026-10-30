"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Sheet } from "@/components/contact-sheet";

/** What tapping an empty time does while choosing a time for a visit (see the calendar's ?pick=). */
export type Pick = { verb: string; href: string };

const quarter = (time: string, m: number) => `${time.slice(0, 3)}${String(m).padStart(2, "0")}`;
const label12 = (t: string) => {
  const h = Number(t.slice(0, 2));
  return `${h % 12 || 12}:${t.slice(3)} ${h < 12 ? "AM" : "PM"}`;
};

/**
 * An empty hour on the day view. Tap it to book a visit or block the time; while choosing a
 * time for a visit (moving one or booking again), it offers that hour's quarter hours instead.
 */
export function SlotButton({ date, time, groomer, label, className, style, children, pick }: {
  date: string; time: string; groomer?: string | null; label: string; className: string; style: CSSProperties; children: ReactNode;
  pick?: Pick | null;
}) {
  const [open, setOpen] = useState(false);
  const options = pick
    ? [0, 15, 30, 45].map((m) => {
        const t = quarter(time, m);
        return { label: `${pick.verb} ${label12(t)}`, href: `${pick.href}date=${date}&time=${t}` };
      })
    : [
        { label: "New appointment", href: `/appointments/new?date=${date}&time=${time}${groomer ? `&groomer=${groomer}` : ""}` },
        { label: "Block time", href: `/calendar/block?date=${date}&start=${time}${groomer ? `&groomer=${groomer}` : ""}` },
      ];
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={style}
        aria-label={pick ? `${label}: ${pick.verb.toLowerCase()} this hour` : `${label}: book or block`}>
        {children}
      </button>
      {open && <Sheet title={label} onClose={() => setOpen(false)} options={options} />}
    </>
  );
}
