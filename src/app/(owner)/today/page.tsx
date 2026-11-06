import type { Metadata } from "next";
import Link from "next/link";
import { Toast } from "@/components/toast";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { listDay, listRange } from "@/lib/data/appointments";
import { directionsUrl, routeUrl } from "@/lib/directions";
import { addDaysYmd, isYmd, longDayLabel, minutesLabel, money, timeLabel, todayYmd, ymd, zonedToUtc } from "@/lib/format";
import { ButtonLink, Empty, Notice, Page, PageHeader, StatusBadge } from "@/components/ui";
import { Chat, Phone, Pin } from "@/components/icons";
import { RouteMap } from "@/components/route-map";
import { DayMap, type DayStop } from "@/components/day-map";
import { MonthStrip, WeekStrip, monthGridStart, shiftMonth } from "@/components/week-strip";
import { locateStops } from "@/lib/geocode";
import { bestOrder, dayRoute, googleMapsOn } from "@/lib/maps";
import { applyRouteOrderAction } from "./route-actions";
import { GroomerFilter } from "@/components/groomer-filter";
import { listGroomers } from "@/lib/data/staff";
import { alertText, vaccineAlerts } from "@/lib/data/vaccines";
import { closedDays } from "@/lib/data/closed";
import { toggleClockAction } from "../clock-actions";
import { petCodesFor } from "@/lib/data/options";
import { PetCodeChips } from "@/components/chips";
import { GoldBanner } from "@/components/gold-banner";
import { waitlistOpenings } from "@/lib/data/waitlist";

export const metadata: Metadata = { title: "Today" };

// The next step on a visit's card, as on the visit page.
const NEXT: Record<string, { to: string; label: string }> = {
  requested: { to: "unconfirmed", label: "Accept" },
  unconfirmed: { to: "en_route", label: "On my way" },
  confirmed: { to: "en_route", label: "On my way" },
  en_route: { to: "in_progress", label: "Check in" },
  in_progress: { to: "completed", label: "Finish" },
};

// The status on a card's dark header: red until the client confirms (like on the calendar).
const CARD_STATUS: Record<string, { label: string; className: string }> = {
  requested: { label: "REQUESTED", className: "bg-warn text-white" },
  unconfirmed: { label: "UNCONFIRMED", className: "bg-danger text-white" },
  confirmed: { label: "CONFIRMED", className: "bg-success text-white" },
  en_route: { label: "ON THE WAY", className: "bg-sky text-navy" },
  in_progress: { label: "CHECKED IN", className: "bg-success text-white" },
  completed: { label: "UNPAID", className: "bg-danger text-white" },
  paid: { label: "PAID", className: "bg-success text-white" },
};

export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const tz = staff.timezone;
  const today = todayYmd(tz);
  const date = isYmd(sp.date) ? sp.date : today;
  // Everything that only needs the date, in one go (each trip to the database costs time).
  const [day, [{ requests }], groomers, closed, [clock], routeEnds, month, openings, [start]] = await Promise.all([
    listDay(staff, date),
    sql<{ requests: number }[]>`
      select count(*)::int as requests from appointments
      where business_id = ${staff.businessId} and status = 'requested' and start_at > now()`,
    listGroomers(staff, { activeOnly: true }),
    closedDays(staff.businessId, date, date),
    sql<{ enabled: boolean; since: Date | null }[]>`
      select b.clock_enabled as enabled,
             (select e.in_at from clock_entries e where e.staff_id = ${staff.staffId} and e.out_at is null) as since
      from businesses b where b.id = ${staff.businessId}`,
    // Where each groomer's day starts and ends: Settings → Team → Van and route.
    sql<{ id: string; start_address: string | null; end_address: string | null }[]>`
      select id, start_address, end_address from staff where business_id = ${staff.businessId}`,
    // Dots: visits on each day of the month grid around the date (it contains the date's week).
    listRange(staff, monthGridStart(date), 42),
    // Spots that opened for someone on the waitlist.
    waitlistOpenings(staff),
    // A new account: the first steps, until it has a few visits.
    sql<{ fresh: boolean; logo: boolean; visits: number }[]>`
      select b.created_at > now() - interval '30 days' as fresh,
             exists (select 1 from business_logos l where l.business_id = b.id) as logo,
             (select count(*)::int from appointments a where a.business_id = b.id) as visits
      from businesses b where b.id = ${staff.businessId}`,
  ]);
  // A route is one groomer's day: yours unless another one (or all) is picked.
  // Without "see every groomer's visits", only their own route.
  const groomer = !staff.can.all_appointments ? staff.staffId : sp.groomer === "all" ? null
    : groomers.some((g) => g.id === sp.groomer) ? (sp.groomer as string)
      : groomers.length > 1 ? staff.staffId : null;
  const all = groomer ? day.filter((a) => a.staff_id === groomer) : day;
  const stops = all.filter((a) => !["cancelled", "no_show"].includes(a.status));
  const ends = routeEnds.find((e) => e.id === (groomer ?? staff.staffId));
  // Driving minutes from Google (only with its key): from the day's start to stop 1, between
  // stops, and from the last stop to the day's end. The stops are placed on the map first.
  const [vaccines, codes, road] = await Promise.all([
    vaccineAlerts(staff, stops.flatMap((s) => s.pets.map((p) => p.id)), date),
    petCodesFor(stops.flatMap((s) => s.pets.map((p) => p.id))),
    locateStops(stops).then(() => stops.length === 0 ? null : dayRoute([
      ...(ends?.start_address ? [{ address: ends.start_address }] : []),
      ...stops.map((s) => ({ address: s.address_line, lat: s.lat, lng: s.lng })),
      ...(ends?.end_address ? [{ address: ends.end_address }] : []),
    ])),
  ]);
  const pins = stops
    .map((s, i) => ({ s, n: i + 1 }))
    .filter(({ s }) => s.lat != null && s.lng != null)
    .map(({ s, n }) => ({
      id: s.id, n, lat: s.lat!, lng: s.lng!, name: s.client_name,
      time: `${timeLabel(s.start_at, tz)} – ${timeLabel(s.end_at, tz)}`, done: s.status === "completed",
    }));
  const dropped = all.filter((a) => ["cancelled", "no_show"].includes(a.status));
  const route = routeUrl(
    [...stops.map((s) => ({ address: s.address_line, lat: s.lat, lng: s.lng })), ...(ends?.end_address ? [{ address: ends.end_address }] : [])],
    ends?.start_address ? { address: ends.start_address } : null,
  );
  // "Find the best order": only for a day not started yet, from where the day starts
  // (and back to where it ends, or home).
  const canOptimize = googleMapsOn() && stops.length >= 2 && stops.every((s) => ["requested", "unconfirmed", "confirmed"].includes(s.status));
  const optimizing = canOptimize && sp.optimize === "1" && !!ends?.start_address;
  const stopPlace = (s: (typeof stops)[number]) => ({ address: s.address_line, lat: s.lat, lng: s.lng });
  const [best, now] = optimizing ? await Promise.all([
    bestOrder({ address: ends!.start_address }, stops.map(stopPlace), { address: ends!.end_address ?? ends!.start_address }),
    dayRoute([{ address: ends!.start_address }, ...stops.map(stopPlace), { address: ends!.end_address ?? ends!.start_address }]),
  ]) : [null, null];
  const legs = road?.minutes ?? null;
  const driveTo = (i: number) => (legs ? legs[i + (ends?.start_address ? 1 : 0) - 1] ?? null : null);
  const driving = legs?.reduce((a, b) => a + b, 0) ?? null;
  const view = sp.view === "list" ? "list" : "map";
  // The dates on top: one week, or the whole month when opened (▾).
  const monthOpen = sp.cal === "1";
  const shown = month
    .filter((a) => (!groomer || a.staff_id === groomer) && !["cancelled", "no_show"].includes(a.status));
  const dotsOn = (d: string) => shown.filter((a) => ymd(a.start_at, tz) === d).length;
  const q = (extra: Record<string, string>) => {
    const params = new URLSearchParams({ date, groomer: groomer ?? "all", ...(view === "list" ? { view } : {}), ...(monthOpen ? { cal: "1" } : {}), ...extra });
    for (const [k, v] of [...params]) if (!v) params.delete(k);
    return `/today?${params}`;
  };
  const cards: DayStop[] = stops.map((s, i) => {
    const next = s.paid ? null : NEXT[s.status] ?? null;
    return {
      id: s.id, n: i + 1, lat: s.lat, lng: s.lng,
      time: `${timeLabel(s.start_at, tz)} – ${timeLabel(s.end_at, tz)}`,
      status: CARD_STATUS[s.paid ? "paid" : s.status] ?? { label: s.status, className: "bg-white/20" },
      client: s.client_name,
      initials: s.client_name.split(/\s+/).map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase(),
      isNew: s.client_new,
      pets: s.pets.map((p) => [p.name, p.breed].filter(Boolean).join(" · ")).join(", "),
      phone: s.client_phone,
      address: s.address_line,
      directions: s.address_line || s.lat != null ? directionsUrl({ address: s.address_line, lat: s.lat, lng: s.lng }) : null,
      next,
      drive: driveTo(i) != null ? `🚐 ${minutesLabel(driveTo(i)!)} drive` : null,
      codes: s.pets.flatMap((p) => codes.get(p.id) ?? []).map((c) => ({ label: c.label, color: c.color })),
      alerts: s.pets.flatMap((p) => vaccines.filter((v) => v.pet_id === p.id).map((v) => `💉 ${p.name}: ${alertText(v)}`)),
    };
  });
  const expected = stops.reduce((sum, s) => sum + s.total_cents, 0);
  const done = stops.filter((s) => s.status === "completed").length;

  return (
    <>
      <PageHeader
        title={date === today ? "Today" : "Route"}
        action={<ButtonLink href={`/appointments/new?date=${date}`}>Book</ButtonLink>}
      />
      <Page>
        {clock.enabled && date === today && (
          <form action={toggleClockAction} className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-2.5 shadow-[var(--shadow-card)]">
            <span className="text-sm">{clock.since ? <>Clocked in since <strong>{timeLabel(clock.since, tz)}</strong></> : "Not clocked in"}</span>
            <button type="submit" className={`rounded-full px-4 py-2 text-sm font-bold ${clock.since ? "bg-navy text-white" : "bg-success text-white"}`}>
              {clock.since ? "Clock out" : "Clock in"}
            </button>
          </form>
        )}
        {sp.denied && <Notice kind="warn">Your role can&apos;t open that page. Ask the owner if you need it.</Notice>}
        {closed.has(date) && <Notice kind="warn">Closed · {closed.get(date)}. Clients can&apos;t book online.</Notice>}
        {requests > 0 && (
          <GoldBanner href="/requests" count={requests} icon="bell" action="Review" compact={view !== "list"}
            title={`${requests} booking request${requests > 1 ? "s" : ""} waiting`} text="Tap to accept or decline" />
        )}
        {openings.length > 0 && (
          <GoldBanner href="/waitlist" count={new Set(openings.map((o) => o.entry_id)).size} icon="bell" action="See" compact={view !== "list"}
            title={`A spot opened · ${new Set(openings.map((o) => o.entry_id)).size} on the waitlist`} text="Text or book them" />
        )}
        <GroomerFilter groomers={staff.can.all_appointments ? groomers : []} current={groomer}
          href={(g) => `/today?date=${date}&groomer=${g ?? "all"}${view === "list" ? "&view=list" : ""}`} />
        <div className="flex items-center gap-1">
          <Link href={q({ date: monthOpen ? shiftMonth(date, -1) : addDaysYmd(date, -1) })}
            aria-label={monthOpen ? "Previous month" : "Previous day"} className="rounded-full p-2 text-lg text-brand">‹</Link>
          <Link href={q({ cal: monthOpen ? "" : "1" })} aria-expanded={monthOpen}
            aria-label={monthOpen ? "Show one week" : "Show the whole month"}
            className="flex min-w-0 flex-1 items-center justify-center gap-1.5 font-bold">
            <span className="truncate">{monthOpen
              ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
              : longDayLabel(zonedToUtc(date, "12:00", tz), tz)}</span>
            <span aria-hidden className="text-brand">{monthOpen ? "▴" : "▾"}</span>
          </Link>
          <Link href={q({ date: monthOpen ? shiftMonth(date, 1) : addDaysYmd(date, 1) })}
            aria-label={monthOpen ? "Next month" : "Next day"} className="rounded-full p-2 text-lg text-brand">›</Link>
          {date !== today && <Link href={q({ date: today })} className="shrink-0 px-1 text-sm font-semibold text-brand">Today</Link>}
        </div>
        {monthOpen ? (
          <MonthStrip date={date} today={today} dots={dotsOn} href={(d) => q({ date: d })}
            monthHref={(n) => q({ date: shiftMonth(date, n) })} />
        ) : (
          <WeekStrip date={date} today={today} dots={dotsOn} href={(d) => q({ date: d })} />
        )}
        {stops.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <p className="min-w-0 flex-1 truncate text-muted">
              <strong className="text-ink">{stops.length}</strong> stop{stops.length > 1 ? "s" : ""} · {done}/{stops.length} done · {money(expected)}
              {driving != null && <> · 🚐 {minutesLabel(driving)}</>}
            </p>
            <nav aria-label="View" className="flex shrink-0 rounded-full bg-surface p-0.5 shadow-[var(--shadow-card)]">
              {(["map", "list"] as const).map((v) => (
                <Link key={v} href={q({ view: v === "list" ? "list" : "" })} aria-current={v === view ? "page" : undefined}
                  className={`rounded-full px-3 py-1 font-semibold ${v === view ? "bg-navy text-white" : "text-muted"}`}>
                  {v === "map" ? "Map" : "List"}
                </Link>
              ))}
              <Link href={`/calendar?view=day&date=${date}${groomer ? `&groomer=${groomer}` : ""}`}
                className="rounded-full px-3 py-1 font-semibold text-muted">Agenda</Link>
            </nav>
          </div>
        )}

        {staff.role === "owner" && start && (sp.welcome === "1" || (start.fresh && start.visits < 3)) && (
          <section aria-label="Get started" className="card space-y-2 border-[#d4af37] p-4">
            <p className="text-lg font-extrabold">👋 Welcome! Set up in a few minutes</p>
            <ol className="space-y-1.5 text-sm">
              {[
                { done: start.logo, href: "/settings/business", label: "Add your logo, address and phone" },
                { done: false, href: "/settings/services", label: "Check your services and prices" },
                { done: false, href: "/settings/hours", label: "Set your working hours" },
                { done: false, href: "/settings/booking", label: "Share your booking link with clients" },
                { done: start.visits > 0, href: "/settings/import", label: "Bring your clients from another app" },
              ].map((x) => (
                <li key={x.href}>
                  <Link href={x.href} className="flex items-center gap-2 font-semibold text-brand">
                    <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${x.done ? "bg-success text-white" : "border border-line"}`}>{x.done ? "✓" : ""}</span>
                    {x.label} ›
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}
        {sp.reordered === "1" && <Toast>The visits are in the new order, with their new times.</Toast>}
        {canOptimize && sp.optimize !== "1" && (
          <Link href={q({ optimize: "1" })}
            className="flex items-center justify-center gap-2 rounded-full border border-[#d4af37] bg-surface py-2 text-sm font-bold text-brand">
            🧭 Find the best order
          </Link>
        )}
        {sp.optimize === "1" && canOptimize && (
          <section aria-label="Best order" className="card space-y-3 border-[#d4af37] p-4">
            {!ends?.start_address ? (
              <p className="text-sm">Set where your day starts (Settings → Team → your name → Van and route) to find the best order.</p>
            ) : !best || !now ? (
              <p className="text-sm">Google couldn&apos;t work out the route right now. Try again in a minute.</p>
            ) : (() => {
              const before = now.minutes.reduce((a, b) => a + b, 0);
              const after = best.minutes.reduce((a, b) => a + b, 0);
              const same = best.order.every((v, i) => v === i);
              const ordered = best.order.map((i) => stops[i]);
              if (same || after >= before) return <p className="font-semibold">✅ Your order is already the best one ({minutesLabel(before)} of driving).</p>;
              return (
                <>
                  <p className="font-bold">🧭 This order saves {minutesLabel(before - after)} of driving</p>
                  <p className="text-sm text-muted">{minutesLabel(before)} now → {minutesLabel(after)}, from the start of your day and back.</p>
                  <ol className="space-y-1 text-sm">
                    {ordered.map((s, i) => (
                      <li key={s.id} className="flex gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate"><strong>{s.client_name}</strong>{s.city && <span className="text-muted"> · {s.city}</span>}</span>
                        <span className="shrink-0 text-muted">🚐 {best.minutes[i]}min</span>
                      </li>
                    ))}
                  </ol>
                  <a href={routeUrl([...ordered.map(stopPlace), ...(ends.end_address ? [{ address: ends.end_address }] : [])], { address: ends.start_address }) ?? "#"}
                    target="_blank" rel="noopener" className="block rounded-full border-2 border-brand py-2 text-center text-sm font-bold text-brand">
                    Open this route in Google Maps ↗
                  </a>
                  <form action={applyRouteOrderAction.bind(null, date)} className="space-y-2">
                    <input type="hidden" name="order" value={ordered.map((s) => s.id).join(",")} />
                    <input type="hidden" name="drive" value={best.minutes.slice(0, ordered.length).join(",")} />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="notify" defaultChecked className="h-4 w-4" /> Text the clients their new time
                    </label>
                    <button type="submit" className="w-full rounded-full bg-brand py-2.5 text-sm font-bold text-white">
                      Use this order (moves the times)
                    </button>
                  </form>
                </>
              );
            })()}
            {sp.clash === "1" && <Notice kind="error">Another visit is in the way of a new time. Move it first, or open the route in Google Maps only.</Notice>}
            <Link href={q({ optimize: "" })} className="block text-center text-sm font-semibold text-muted">Close</Link>
          </section>
        )}

        {stops.length === 0 ? (
          <Empty title="No appointments this day">
            <Link href={`/appointments/new?date=${date}`} className="text-brand underline">Book one</Link>
          </Empty>
        ) : view === "map" ? (
          <>
            <div className="-mx-4 -mb-24">
              <DayMap stops={cards} path={road?.path} route={route} compact={monthOpen} />
            </div>
          </>
        ) : (
          <>
            <div className={`grid ${driving != null ? "grid-cols-4" : "grid-cols-3"} gap-2 text-center`}>
              <Stat label="Stops" value={String(stops.length)} />
              <Stat label="Done" value={`${done}/${stops.length}`} />
              <Stat label="Expected" value={money(expected)} />
              {driving != null && <Stat label="Driving" value={minutesLabel(driving)} />}
            </div>

            {pins.length > 0 && <RouteMap stops={pins} path={road?.path} />}
            {pins.length < stops.length && (
              <p className="-mt-2 text-center text-xs text-muted">
                {stops.length - pins.length} stop{stops.length - pins.length > 1 ? "s" : ""} not on the map (address not found).
              </p>
            )}

            {route && (
              <ButtonLink href={route} target="_blank" className="w-full">
                Open the whole route in Google Maps
              </ButtonLink>
            )}

            <ol className="space-y-3">
              {stops.map((s, i) => (
                <li key={s.id} className="space-y-3">
                  {driveTo(i) != null && (
                    <p className="text-center text-xs font-semibold text-muted">🚐 {minutesLabel(driveTo(i)!)} drive{i === 0 ? " from the start" : ""}</p>
                  )}
                  <div className="card overflow-hidden">
                  <Link href={`/appointments/${s.id}`} className="flex gap-3 p-4">
                    <div className="w-16 shrink-0">
                      <span aria-hidden className="mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <div className="font-bold leading-tight">{timeLabel(s.start_at, tz)}</div>
                      <div className="text-xs text-muted">{timeLabel(s.end_at, tz)}</div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-lg font-bold leading-tight">{s.client_name}</span>
                        <StatusBadge status={s.paid ? "paid" : s.status} />
                      </div>
                      {s.pets.map((p) => (
                        <div key={p.name} className="truncate text-sm">
                          <span className="font-semibold">{p.name}</span>{" "}
                          <PetCodeChips codes={codes.get(p.id)} />
                          <span className="text-muted"> · {p.services.join(", ")}</span>
                        </div>
                      ))}
                      <div className="truncate text-sm text-muted">{s.address_line ?? "No address"}</div>
                      {s.pets.flatMap((p) => vaccines.filter((v) => v.pet_id === p.id).map((v) => (
                        <div key={p.id + v.name} className={`text-xs font-semibold ${v.expired ? "text-danger" : "text-warn"}`}>
                          💉 {p.name}: {alertText(v)}
                        </div>
                      )))}
                    </div>
                  </Link>
                  <div className="grid grid-cols-3 divide-x divide-line border-t border-line text-sm font-semibold text-brand">
                    {s.address_line ? (
                      <a href={directionsUrl({ address: s.address_line, lat: s.lat, lng: s.lng })} target="_blank" rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 py-3 hover:bg-brand-soft">
                        <Pin size={16} /> Directions
                      </a>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5 py-3 text-muted">No address</span>
                    )}
                    <a href={`sms:${s.client_phone}`} className="flex items-center justify-center gap-1.5 py-3 hover:bg-brand-soft">
                      <Chat size={16} /> Text
                    </a>
                    <a href={`tel:${s.client_phone}`} className="flex items-center justify-center gap-1.5 py-3 hover:bg-brand-soft">
                      <Phone size={16} /> Call
                    </a>
                  </div>
                  </div>
                </li>
              ))}
            </ol>
            {ends?.end_address && legs && (
              <p className="text-center text-xs font-semibold text-muted">🚐 {minutesLabel(legs.at(-1)!)} drive back to the end of the day</p>
            )}
          </>
        )}
        {/* Off the route but still here, so a visit never just disappears: tap to see or restore it. */}
        {dropped.length > 0 && (
          <section className="space-y-2">
            <h2 className="section-label">Cancelled or no-show</h2>
            <ul className="card divide-y divide-line overflow-hidden">
              {dropped.map((s) => (
                <li key={s.id}>
                  <Link href={`/appointments/${s.id}`} className="flex items-center gap-3 px-4 py-3 text-muted">
                    <span className="w-16 shrink-0 text-sm font-semibold">{timeLabel(s.start_at, tz)}</span>
                    <span className="min-w-0 flex-1 truncate">{s.client_name}</span>
                    <StatusBadge status={s.status} />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-center text-xs text-muted">Marked by mistake? Open it and tap Restore.</p>
          </section>
        )}
      </Page>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-2 py-3">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
