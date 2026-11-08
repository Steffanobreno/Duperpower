"use client";
import type { ReactNode } from "react";
import { recordOffer } from "./actions";

/**
 * Wraps the send links of one row: a tap on any of them records the invite. The link itself
 * opens as usual (WhatsApp or Messages); recording happens alongside.
 */
export function RecordOffer({ clientId, date, children }: { clientId: string; date: string; children: ReactNode }) {
  return (
    <div className="contents"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) recordOffer(clientId, date).catch(() => null);
      }}>
      {children}
    </div>
  );
}
