"use client";
import type { ReactNode } from "react";
import { markReportSent } from "../report-actions";

/**
 * Wraps the report card's send-from-phone links: a tap on either notes the card as sent (the card
 * shows "Sent …", the panel counts it, and the automatic email skips it). The link opens as usual.
 */
export function RecordReportSent({ appointmentId, children }: { appointmentId: string; children: ReactNode }) {
  return (
    <div className="contents"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) markReportSent(appointmentId).catch(() => null);
      }}>
      {children}
    </div>
  );
}
