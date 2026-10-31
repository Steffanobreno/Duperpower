import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { listDay } from "@/lib/data/appointments";
import { directionsUrl, routeUrl } from "@/lib/directions";
import { addDaysYmd, isYmd, longDayLabel, minutesLabel, money, timeLabel, todayYmd, zonedToUtc } from "@/lib/format";
import { ButtonLink, Empty, Notice, Page, PageHeader, StatusBadge } from "@/components/ui";
import { DayNav } from "@/components/day-nav";
import { Chat, Phone, Pin } from "@/components/icons";
import { RouteMap } from "@/components/route-map";
import { locateStops } from "@/lib/geocode";
import { dayRoute } from "@/lib/maps";
import { GroomerFilter } from "@/components/groomer-filter";
import { listGroomers } from "@/lib/data/staff";
import { alertText, vaccineAlerts } from "@/lib/data/vaccines";
import { closedDays } from "@/lib/data/closed";
import { toggleClockAction } from "../clock-actions";
import { petCodesFor } from "@/lib/data/options";
import { PetCodeChips } from "@/components/chips";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const tz = staff.timezone;
  const today = todayYmd(tz);
  const date = isYmd(sp.date) ? sp.date : today;
  const [day, [{ requests }], groomers, closed] = await Promise.all([
    listDay(staff, date),
    sql<{ requests: number }[]>`
      select count(*)::int as requests from appointments
      where business_id = ${staff.businessId} and status = 'requested' and start_at > now()`,
    listGroomers(staff, { activeOnly: true }),
    closedDays(staff.businessId, date, date),
  ]);
  const [clock] = await sql<{ enabled: boolean; since: Date | null }[]>`
    select b.clock_enabled as enabled,
           (select e.in_at from clock_entries e where e.staff_id = ${staff.staffId} and e.out_at is null) as since
    from businesses b where b.id = ${staff.businessId}`;
  // A route is one groomer's day: yours unless another one (or all) is picked.
  // Without "see every groomer's visits", only their own route.
  const groomer = !staff.can.all_appointments ? staff.staffId : sp.groomer === "all" ? null
    : groomers.some((g) => g.id === sp.groomer) ? (sp.groomer as string)
      : groomers.length > 1 ? staff.staffId : null;
  const all = groomer ? day.filter((a) => a.staff_id === groomer) : day;
  const stops = all.filter((a) => !["cancelled", "no_show"].includes(a.status));
  const [vaccines, , codes] = await Promise.all([
    vaccineAlerts(staff, stops.flatMap((s) => s.pets.map((p) => p.id)), date),
    locateStops(stops),
    petCodesFor(stops.flatMap((s) => s.pets.map((p) => p.id))),
  ]);
  const pins = stops
    .map((s, i) => ({ s, n: i + 1 }))
    .filter(({ s }) => s.lat != null && s.lng != null)
    .map(({ s, n }) => ({
      id: s.id, n, lat: s.lat!, lng: s.lng!, name: s.client_name,
      time: `${timeLabel(s.start_at, tz)} – ${timeLabel(s.end_at, tz)}`, done: s.status === "completed",
    }));
  const dropped = all.filter((a) => ["cancelled", "no_show"].includes(a.status));
  // The route starts (and ends, when set) where the groomer's day does: Settings → Team → Van and route.
  const [ends] = await sql<{ start_address: string | null; end_address: string | null }[]>`
    select start_address, end_address from staff where id = ${groomer ?? staff.staffId}`;
  const route = routeUrl(
    [...stops.map((s) => ({ address: s.address_line, lat: s.lat, lng: s.lng })), ...(ends?.end_address ? [{ address: ends.end_address }] : [])],
    ends?.start_address ? { address: ends.start_address } : null,
  );
  // Driving minutes from Google (only with its key): from the day's start to stop 1, between
  // stops, and from the last stop to the day's end.
  const road = stops.length === 0 ? null : await dayRoute([
    ...(ends?.start_address ? [{ address: ends.start_address }] : []),
    ...stops.map((s) => ({ address: s.address_line, lat: s.lat, lng: s.lng })),
    ...(ends?.end_address ? [{ address: ends.end_address }] : []),
  ]);
  const legs = road?.minutes ?? null;
  const driveTo = (i: number) => (legs ? legs[i + (ends?.start_address ? 1 : 0) - 1] ?? null : null);
  const driving = legs?.reduce((a, b) => a + b, 0) ?? null;
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
          <ButtonLink href="/requests" kind="secondary" className="w-full border-warn bg-warn-soft text-warn">
            {requests} booking request{requests > 1 ? "s" : ""} waiting
          </ButtonLink>
        )}
        <GroomerFilter groomers={staff.can.all_appointments ? groomers : []} current={groomer}
          href={(g) => `/today?date=${date}&groomer=${g ?? "all"}`} />
        <DayNav
          base={`/today?groomer=${groomer ?? "all"}&`}
          prev={addDaysYmd(date, -1)}
          next={addDaysYmd(date, 1)}
          today={today}
          label={longDayLabel(zonedToUtc(date, "12:00", tz), tz)}
          isToday={date === today}
        />

        {stops.length === 0 ? (
          <Empty title="No appointments this day">
            <Link href={`/appointments/new?date=${date}`} className="text-brand underline">Book one</Link>
          </Empty>
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
