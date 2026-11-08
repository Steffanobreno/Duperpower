import type { ReactNode } from "react";

/** The test mode's label (the fake payment gateway): no real charges are made. */
export function TestModeBanner({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-xl border-2 border-dashed border-warn bg-warn-soft px-3 py-2 text-center text-sm font-bold text-warn">
      {children}
    </p>
  );
}
