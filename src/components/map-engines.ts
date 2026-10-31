"use client";
import type { DayStop } from "./day-map";

// The Today map is drawn by one of two engines, with the same pins, route and highlighting:
// - Google Maps (the Maps JavaScript API), when NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is set;
// - OpenStreetMap through Leaflet otherwise (free, no key).

export type MapEngine = {
  /** Make this visit's pin stand out (orange, bigger, on top) and center the map on it. */
  focus: (stop: DayStop | undefined) => void;
  destroy: () => void;
};

type Draw = { box: HTMLElement; stops: DayStop[]; path?: [number, number][]; onPin: (index: number) => void };

const placedOf = (stops: DayStop[]) => stops.filter((s) => s.lat != null && s.lng != null);

// ---------- Google ----------

const browserKey = () => process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY || null;
const REFUSED = "woofers-google-map-refused";
const refused = () => {
  try {
    return sessionStorage.getItem(REFUSED) === "1";
  } catch {
    return false;
  }
};
export const googleMapOn = () => !!browserKey() && !refused();

type G = typeof google.maps;
let loading: Promise<G> | null = null;

/** Loads the Maps JavaScript API once (tests point it at a fake with NEXT_PUBLIC_GOOGLE_MAPS_SCRIPT_URL). */
function loadGoogle(): Promise<G> {
  loading ??= new Promise<G>((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>;
    // Google calls this when it refuses the key (e.g. the site isn't in its allowed list): use the
    // free map for the rest of this visit instead of Google's grey error box.
    w.gm_authFailure = () => {
      try {
        sessionStorage.setItem(REFUSED, "1");
      } catch {}
      location.reload();
    };
    w.__woofersMapsReady = () => resolve((window as unknown as { google: { maps: G } }).google.maps);
    const s = document.createElement("script");
    const base = process.env.NEXT_PUBLIC_GOOGLE_MAPS_SCRIPT_URL || "https://maps.googleapis.com/maps/api/js";
    s.src = `${base}?key=${encodeURIComponent(browserKey()!)}&v=weekly&callback=__woofersMapsReady`;
    s.async = true;
    s.onerror = () => {
      loading = null;
      reject(new Error("Google Maps did not load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** The numbered pin as a small SVG: navy, green when done, orange when its card is showing. */
function pinIcon(g: G, n: number, color: string, big: boolean) {
  const [w, h] = big ? [40, 50] : [32, 40];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 32 40">
<path d="M16 39C16 39 2 24 2 15a14 14 0 0 1 28 0c0 9-14 24-14 24Z" fill="${color}" stroke="#fff" stroke-width="2"/>
<text x="16" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="800" fill="#fff">${n}</text></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new g.Size(w, h),
    anchor: new g.Point(w / 2, h),
  };
}

async function googleEngine({ box, stops, path, onPin }: Draw): Promise<MapEngine> {
  const g = await loadGoogle();
  const map = new g.Map(box, {
    disableDefaultUI: true,
    zoomControl: false,
    clickableIcons: false,
    gestureHandling: "greedy",
    center: { lat: 37.56, lng: -122.32 },
    zoom: 10,
  });
  const placed = placedOf(stops);
  const color = (s: DayStop) => (s.status.label === "PAID" || s.status.label === "UNPAID" ? "#1f9d55" : "#0b1f3a");
  const markers = new Map(placed.map((s) => {
    const m = new g.Marker({ position: { lat: s.lat!, lng: s.lng! }, map, icon: pinIcon(g, s.n, color(s), false), title: `${s.n}. ${s.client}` });
    m.addListener("click", () => onPin(stops.indexOf(s)));
    return [s.id, { m, s }] as const;
  }));
  const line = path && path.length > 1 ? path.map(([lat, lng]) => ({ lat, lng })) : placed.map((s) => ({ lat: s.lat!, lng: s.lng! }));
  if (line.length > 1) {
    new g.Polyline({
      path: line, map, strokeColor: "#0a84cc", strokeWeight: 4, strokeOpacity: path && path.length > 1 ? 0.85 : 0,
      // Without the road path, dashes between the stops.
      icons: path && path.length > 1 ? [] : [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, scale: 3 }, offset: "0", repeat: "14px" }],
    });
  }
  const bounds = new g.LatLngBounds();
  for (const p of [...placed.map((s) => ({ lat: s.lat!, lng: s.lng! })), ...line]) bounds.extend(p);
  if (placed.length === 1 && line.length <= 1) {
    map.setCenter({ lat: placed[0].lat!, lng: placed[0].lng! });
    map.setZoom(14);
  } else if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { top: 40, left: 40, right: 40, bottom: 200 });
  }
  return {
    focus(stop) {
      for (const { m, s } of markers.values()) {
        const on = s.id === stop?.id;
        m.setIcon(pinIcon(g, s.n, on ? "#f97316" : color(s), on));
        m.setZIndex(on ? 1000 : s.n);
      }
      if (stop?.lat != null && stop.lng != null) map.panTo({ lat: stop.lat, lng: stop.lng });
    },
    destroy() {
      for (const { m } of markers.values()) m.setMap(null);
      g.event.clearInstanceListeners(map);
      box.replaceChildren();
    },
  };
}

// ---------- OpenStreetMap (Leaflet) ----------

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function leafletEngine({ box, stops, path, onPin }: Draw): Promise<MapEngine> {
  const L = await import("leaflet");
  const map = L.map(box, { zoomControl: false });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  const placed = placedOf(stops);
  const points = placed.map((s) => L.latLng(s.lat!, s.lng!));
  if (path && path.length > 1) L.polyline(path, { color: "#0a84cc", weight: 4, opacity: 0.85 }).addTo(map);
  else if (points.length > 1) L.polyline(points, { color: "#0a84cc", weight: 3, dashArray: "8 8", opacity: 0.9 }).addTo(map);
  const markers = new Map<string, import("leaflet").Marker>();
  for (const s of placed) {
    const icon = L.divIcon({
      className: "",
      iconSize: [32, 40],
      iconAnchor: [16, 40],
      html: `<div class="route-pin" data-stop="${esc(s.id)}"><span>${s.n}</span></div>`,
    });
    markers.set(s.id, L.marker([s.lat!, s.lng!], { icon, title: `${s.n}. ${s.client}`, keyboard: false })
      .on("click", () => onPin(stops.indexOf(s)))
      .addTo(map));
  }
  const all = path && path.length > 1 ? [...points, ...path.map(([a, b]) => L.latLng(a, b))] : points;
  if (all.length === 1) map.setView(all[0], 14);
  else if (all.length) map.fitBounds(L.latLngBounds(all), { padding: [40, 40], paddingBottomRight: [40, 200] });
  else map.setView([37.56, -122.32], 10);
  return {
    focus(stop) {
      for (const [id, m] of markers) m.getElement()?.querySelector(".route-pin")?.classList.toggle("route-pin-active", id === stop?.id);
      if (stop?.lat != null && stop.lng != null) map.panTo([stop.lat, stop.lng], { animate: true });
    },
    destroy() {
      map.remove();
    },
  };
}

/** Draws the day on Google Maps when its browser key is set (falling back to OpenStreetMap if it won't load). */
export async function drawDayMap(d: Draw): Promise<MapEngine> {
  if (googleMapOn()) {
    try {
      return await googleEngine(d);
    } catch {
      // The key is wrong or Google is unreachable: the free map still shows the day.
    }
  }
  return leafletEngine(d);
}
