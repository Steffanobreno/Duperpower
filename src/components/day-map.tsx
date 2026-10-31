"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import "leaflet/dist/leaflet.css";
import { setStatusAction } from "@/app/(owner)/appointments/actions";

// The groomer's day as a map with the visits as cards along the bottom (MoeGo-style).
// Swiping the cards moves to the next visit and centers its pin; tapping a pin shows its card.
// OpenStreetMap tiles through Leaflet; the road path comes from Google when it's set up.

export type DayStop = {
  id: string;
  n: number;
  lat: number | null;
  lng: number | null;
  time: string; // "8:45 AM – 10:45 AM"
  status: { label: string; className: string };
  client: string;
  initials: string;
  isNew: boolean;
  pets: string; // "Buddy · Havanese"
  phone: string;
  address: string | null;
  directions: string | null;
  next: { to: string; label: string } | null;
  drive: string | null; // "🚐 12min drive" to this stop
  codes: { label: string; color: string }[]; // the pets' codes (Matted, Biter…)
  alerts: string[]; // "💉 Biscuit: Rabies expired Oct 29"
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function DayMap({ stops, path, route, compact = false }: {
  stops: DayStop[]; path?: [number, number][]; route?: string | null;
  /** Smaller, when the whole month is open above it. */
  compact?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const markers = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const [active, setActive] = useState(0);
  const key = JSON.stringify(stops.map((s) => [s.id, s.lat, s.lng])) + (path?.length ?? 0);

  const show = (i: number, smooth = true) => {
    const card = rail.current?.children[i] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", inline: "center", block: "nearest" });
  };

  // The map, its pins and the route.
  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | undefined;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !box.current) return;
      map = L.map(box.current, { zoomControl: false });
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      const placed = stops.filter((s) => s.lat != null && s.lng != null);
      const points = placed.map((s) => L.latLng(s.lat!, s.lng!));
      if (path && path.length > 1) L.polyline(path, { color: "#0a84cc", weight: 4, opacity: 0.85 }).addTo(map);
      else if (points.length > 1) L.polyline(points, { color: "#0a84cc", weight: 3, dashArray: "8 8", opacity: 0.9 }).addTo(map);
      markers.current.clear();
      for (const s of placed) {
        const icon = L.divIcon({
          className: "",
          iconSize: [32, 40],
          iconAnchor: [16, 40],
          html: `<div class="route-pin" data-stop="${esc(s.id)}"><span>${s.n}</span></div>`,
        });
        const m = L.marker([s.lat!, s.lng!], { icon, title: `${s.n}. ${s.client}`, keyboard: false })
          .on("click", () => show(stops.indexOf(s)))
          .addTo(map);
        markers.current.set(s.id, m);
      }
      const all = path && path.length > 1 ? [...points, ...path.map(([a, b]) => L.latLng(a, b))] : points;
      if (all.length === 1) map.setView(all[0], 14);
      else if (all.length) map.fitBounds(L.latLngBounds(all), { padding: [40, 40], paddingBottomRight: [40, 200] });
      else map.setView([37.56, -122.32], 10);
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redraw only when the stops or the path change
  }, [key]);

  // The card in the middle of the rail is the active visit: highlight and center its pin.
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const onScroll = () => {
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      [...el.children].forEach((c, i) => {
        const card = c as HTMLElement;
        if (Math.abs(card.offsetLeft + card.offsetWidth / 2 - mid) < Math.abs((el.children[best] as HTMLElement).offsetLeft + (el.children[best] as HTMLElement).offsetWidth / 2 - mid)) best = i;
      });
      setActive(best);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const s = stops[active];
    for (const [id, m] of markers.current) m.getElement()?.querySelector(".route-pin")?.classList.toggle("route-pin-active", id === s?.id);
    if (s?.lat != null && s.lng != null && mapRef.current) mapRef.current.panTo([s.lat, s.lng], { animate: true });
  }, [active, stops]);

  return (
    // Fills the screen between the week and the tab bar.
    <div className="relative isolate z-0 overflow-hidden"
      style={compact ? { height: 330 } : { height: "calc(100dvh - 22rem - env(safe-area-inset-bottom))", minHeight: 380 }}>
      <div ref={box} className="absolute inset-0" role="img" aria-label="Map of the day's visits" />
      {route && (
        <a href={route} target="_blank" rel="noopener"
          className="absolute right-3 top-3 z-[500] rounded-full bg-surface px-3 py-2 text-sm font-bold text-brand shadow-lg">
          Route in Google Maps ↗
        </a>
      )}
      {stops.length > 0 && (
        <div ref={rail} role="list" aria-label="Visits"
          className="absolute inset-x-0 bottom-3 z-[500] flex snap-x snap-mandatory gap-3 overflow-x-auto px-[7.5%] pb-1 [scrollbar-width:none]">
          {stops.map((s, i) => <Card key={s.id} s={s} active={i === active} />)}
        </div>
      )}
    </div>
  );
}

function Card({ s, active }: { s: DayStop; active: boolean }) {
  const [contact, setContact] = useState(false);
  const [pending, start] = useTransition();
  const button = "flex flex-1 flex-col items-center gap-1 py-2.5 text-sm font-semibold text-brand disabled:opacity-50";
  return (
    <article role="listitem" aria-current={active || undefined}
      className={`w-[85%] shrink-0 snap-center overflow-hidden rounded-2xl bg-surface shadow-lg ring-1 ${active ? "ring-brand" : "ring-line"}`}>
      <div className="flex items-center justify-between gap-2 whitespace-nowrap bg-navy px-4 py-2 text-[13px] font-bold text-white">
        <span>{s.n}. {s.time}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${s.status.className}`}>{s.status.label}</span>
      </div>
      <Link href={`/appointments/${s.id}`} className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">{s.initials}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-lg font-bold">{s.client}</span>
            {s.isNew && <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">New</span>}
          </span>
          <span className="block truncate text-sm font-semibold text-muted">{s.pets}</span>
          {s.codes.length > 0 && (
            <span className="mt-0.5 flex flex-wrap gap-1">
              {s.codes.map((c) => (
                <span key={c.label} className="rounded-full px-2 py-0.5 text-[11px] font-bold leading-4 text-white" style={{ background: c.color }}>{c.label}</span>
              ))}
            </span>
          )}
          {s.alerts.map((a) => <span key={a} className="block truncate text-xs font-semibold text-danger">{a}</span>)}
          {s.drive && <span className="block truncate text-xs text-muted">{s.drive}</span>}
        </span>
      </Link>
      {contact ? (
        <div className="flex border-t border-line">
          <a href={`tel:${s.phone}`} className={button}>Call</a>
          <a href={`sms:${s.phone}`} className={button}>Text</a>
          <button type="button" onClick={() => setContact(false)} className={`${button} text-muted`}>Close</button>
        </div>
      ) : (
        <div className="flex border-t border-line">
          <button type="button" onClick={() => setContact(true)} className={button}>Contact</button>
          {s.directions ? <a href={s.directions} target="_blank" rel="noopener" className={button}>Directions</a>
            : <span className={`${button} text-muted`}>No address</span>}
          {s.next ? (
            <button type="button" disabled={pending} className={button}
              onClick={() => start(() => setStatusAction(s.id, s.next!.to))}>
              {pending ? "…" : s.next.label}
            </button>
          ) : (
            <Link href={`/appointments/${s.id}`} className={button}>Open</Link>
          )}
        </div>
      )}
    </article>
  );
}
