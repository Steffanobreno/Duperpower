"use client";
import { useState, type ReactNode } from "react";
import { etaAction } from "@/app/(owner)/appointments/eta-actions";
import { setStatusAction } from "@/app/(owner)/appointments/actions";

// "On my way": texts the client with the arrival time worked out from where the phone is
// (Google, with today's traffic), and marks the visit "On the way". Without the location (or
// without Google) the text goes as written. {eta} in the message is replaced with the time;
// without it, the time is added at the end.

const where = () =>
  new Promise<GeolocationPosition | null>((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: false, timeout: 6000, maximumAge: 60_000 });
  });

export function withEta(text: string, eta: { minutes: number; arrive: string } | null) {
  const when = eta ? `about ${eta.minutes} min (around ${eta.arrive})` : null;
  if (text.includes("{eta}")) return text.replaceAll("{eta}", when ?? "soon");
  return when ? `${text.trimEnd()} We'll be there in ${when}.` : text;
}

export function OnMyWayButton({ appointmentId, phone, text, markEnRoute, className, children }: {
  appointmentId: string; phone: string; text: string; markEnRoute: boolean; className?: string; children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy} className={className} aria-busy={busy}
      onClick={async () => {
        setBusy(true);
        const pos = await where();
        const eta = pos ? await etaAction(appointmentId, pos.coords.latitude, pos.coords.longitude).catch(() => null) : null;
        if (markEnRoute) await setStatusAction(appointmentId, "en_route").catch(() => null);
        setBusy(false);
        const url = `sms:${phone}&body=${encodeURIComponent(withEta(text, eta))}`;
        // Tests catch the text here instead of opening Messages.
        const hook = (window as unknown as { __woofersSms?: (u: string) => void }).__woofersSms;
        if (hook) hook(url);
        else window.location.href = url;
      }}>
      {children}
    </button>
  );
}
