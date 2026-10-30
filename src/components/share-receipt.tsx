"use client";
import { useState } from "react";

/**
 * Sends the receipt PDF through the phone's share sheet (Messages, WhatsApp, Mail…), or
 * downloads it where sharing files isn't possible.
 */
export function ShareReceiptButton({ pdfUrl, fileName, className, children, busyLabel = "Preparing…" }: {
  pdfUrl: string; fileName: string; className?: string; children: React.ReactNode; busyLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={className}
      onClick={async () => {
        setBusy(true);
        try {
          const blob = await (await fetch(pdfUrl)).blob();
          const file = new File([blob], fileName, { type: "application/pdf" });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: fileName });
          } else {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(a.href);
          }
        } catch {
          // The person closed the share sheet: nothing to do.
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? busyLabel : children}
    </button>
  );
}
