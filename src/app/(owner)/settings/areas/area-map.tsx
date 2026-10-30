"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type AreaPoint = { lat: number; lng: number; color: string; label: string };

/** The ZIP codes of the service areas as colored dots on a map (OpenStreetMap, no key). */
export function AreaMap({ points }: { points: AreaPoint[] }) {
  const box = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(points);
  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !box.current || !points.length) return;
      map = L.map(box.current, { zoomControl: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      for (const p of points) {
        L.circle([p.lat, p.lng], { radius: 1600, color: p.color, fillColor: p.color, fillOpacity: 0.35, weight: 1 })
          .bindTooltip(p.label).addTo(map);
      }
      map.fitBounds(L.latLngBounds(points.map((p) => L.latLng(p.lat, p.lng))).pad(0.15), { maxZoom: 11 });
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redraw only when the points change
  }, [key]);
  if (!points.length) return null;
  return <div ref={box} className="h-64 w-full overflow-hidden rounded-[var(--radius-card)] border border-line" role="img" aria-label="Map of the service areas" />;
}
