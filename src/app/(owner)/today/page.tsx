import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { listDay } from "@/lib/data/appointments";
import { directionsUrl, routeUrl } from "@/lib/directions";
import { addDaysYmd, isYmd, longDayLabel, money, timeLabel, todayYmd, zonedToUtc } from "@/lib/format";
import { ButtonLink, Card, Empty, Page, PageHeader, StatusBadge } from "@/components/ui";
import { DayNav } from "@/components/day-nav";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const tz = staff.timezone;
  const today = todayYmd(tz);
  const date = isYmd(sp.date) ? sp.date : today;
  const all = await listDay(staff, date);
  const stops = all.filter((a) => !["cancelled", "no_show"].includes(a.status));
  const dropped = all.length - stops.length;
  const route = routeUrl(stops.map((s) => ({ address: s.address_line, lat: s.lat, lng: s.lng })));
  const expected = stops.reduce((sum, s) => sum + s.total_cents, 0);
  const done = stops.filter((s) => s.status === "completed").length;
  const embedKey = process.env.GOOGLE_MAPS_API_KEY;
  const [{ requests }] = await sql<{ requests: number }[]>`
    select count(*)::int as requests from appointments where business_id = ${staff.businessId} and status = 'requested'`;

  return (
    <>
      <PageHeader
        title={date === today ? "Today" : "Route"}
        action={<ButtonLink href={`/appointments/new?date=${date}`}>Book</ButtonLink>}
      />
      <Page>
        {requests > 0 && (
          <ButtonLink href="/requests" kind="secondary" className="w-full border-warn bg-warn-soft text-warn">
            {requests} booking request{requests > 1 ? "s" : ""} waiting
          </ButtonLink>
        )}
        <DayNav
          base="/today?"
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
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Stops" value={String(stops.length)} />
              <Stat label="Done" value={`${done}/${stops.length}`} />
              <Stat label="Expected" value={money(expected)} />
            </div>

            {route && (
              <ButtonLink href={route} target="_blank" className="w-full">
                Open the whole route in Google Maps
              </ButtonLink>
            )}

            {embedKey && route && stops.some((s) => s.address_line) && (
              <iframe
                title="Route map"
                className="h-64 w-full rounded-[var(--radius-card)] border border-line"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={embedUrl(embedKey, stops)}
              />
            )}

            <ol className="space-y-2">
              {stops.map((s, i) => (
                <li key={s.id}>
                  <Card className="space-y-2">
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-on-brand"
                      >
                        {i + 1}
                      </span>
                      <Link href={`/appointments/${s.id}`} className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold">
                            {timeLabel(s.start_at, tz)} · {s.client_name}
                          </span>
                          <StatusBadge status={s.paid ? "paid" : s.status} />
                        </div>
                        <div className="truncate text-sm text-muted">
                          {s.pets.map((p) => `${p.name} (${p.services.join(", ")})`).join(" · ")}
                        </div>
                        <div className="truncate text-sm">{s.address_line ?? "No address"}</div>
                      </Link>
                    </div>
                    <div className="flex gap-2 pl-10">
                      {s.address_line && (
                        <ButtonLink
                          kind="secondary"
                          href={directionsUrl({ address: s.address_line, lat: s.lat, lng: s.lng })}
                          target="_blank"
                          className="flex-1"
                        >
                          Directions
                        </ButtonLink>
                      )}
                      <ButtonLink kind="secondary" href={`sms:${s.client_phone}`} className="flex-1">
                        Text
                      </ButtonLink>
                      <ButtonLink kind="secondary" href={`/appointments/${s.id}`} className="flex-1">
                        Open
                      </ButtonLink>
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          </>
        )}
        {dropped > 0 && (
          <p className="text-center text-sm text-muted">
            {dropped} cancelled or no-show not shown. <Link href={`/calendar?date=${date}`} className="underline">See all</Link>
          </p>
        )}
      </Page>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface px-2 py-3">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

// Google Maps Embed API (free, iframe). The key must be restricted to this site's domain.
function embedUrl(key: string, stops: { address_line: string | null; lat: number | null; lng: number | null }[]) {
  const points = stops
    .map((s) => (s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : s.address_line))
    .filter((p): p is string => !!p);
  const u = new URL("https://www.google.com/maps/embed/v1/" + (points.length > 1 ? "directions" : "place"));
  u.searchParams.set("key", key);
  if (points.length > 1) {
    u.searchParams.set("origin", points[0]);
    u.searchParams.set("destination", points[points.length - 1]);
    if (points.length > 2) u.searchParams.set("waypoints", points.slice(1, -1).slice(0, 20).join("|"));
  } else {
    u.searchParams.set("q", points[0]);
  }
  return u.toString();
}
