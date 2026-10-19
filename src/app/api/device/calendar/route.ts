import { sql } from "@/lib/db";
import { businessForDeviceKey } from "@/lib/device";

// Calendar feed of the visits. Two formats:
// - iCalendar (default): Google Calendar → Other calendars → From URL. Google refreshes it on
//   its own schedule (usually every few hours).
// - JSON (?format=json): read every 15 minutes by the Google Apps Script shown in
//   Settings → Google Calendar, which copies the visits into a real Google calendar.

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Lines longer than 75 octets must be folded (RFC 5545).
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const business = await businessForDeviceKey(url.searchParams.get("key"));
  if (!business) return new Response("Unknown key", { status: 401 });

  const rows = await sql<
    { id: string; start_at: Date; end_at: Date; status: string; address_line: string | null; notes: string | null;
      client: string; phone: string; pets: string | null; services: string | null; updated_at: Date }[]
  >`
    select a.id, a.start_at, a.end_at, a.status, a.address_line, a.notes, a.updated_at,
           trim(c.first_name || ' ' || c.last_name) as client, c.phone,
           (select string_agg(p.name, ' & ' order by p.name) from appointment_pets ap join pets p on p.id = ap.pet_id
             where ap.appointment_id = a.id) as pets,
           (select string_agg(s.name, ', ') from appointment_pets ap join appointment_services s on s.appointment_pet_id = ap.id
             where ap.appointment_id = a.id) as services
    from appointments a join clients c on c.id = a.client_id
    where a.business_id = ${business.id}
      and a.start_at > now() - interval '30 days' and a.start_at < now() + interval '180 days'
      and a.status in ('requested', 'unconfirmed', 'confirmed', 'en_route', 'in_progress', 'completed')
    order by a.start_at`;

  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const titleOf = (r: (typeof rows)[number]) => `${r.status === "requested" ? "[Request] " : ""}${r.pets ?? "Grooming"} · ${r.client}`;
  const descriptionOf = (r: (typeof rows)[number]) =>
    [r.services, r.phone, r.notes, appUrl && `${appUrl}/appointments/${r.id}`].filter(Boolean).join("\n");

  if (url.searchParams.get("format") === "json") {
    await sql`update businesses set calendar_synced_at = now() where id = ${business.id}`;
    return Response.json(
      {
        from: new Date(Date.now() - 30 * 86_400_000).toISOString(),
        to: new Date(Date.now() + 180 * 86_400_000).toISOString(),
        events: rows.map((r) => ({
          id: r.id,
          version: `${r.updated_at.toISOString()}|${r.status}`,
          title: titleOf(r),
          start: r.start_at.toISOString(),
          end: r.end_at.toISOString(),
          location: r.address_line ?? "",
          description: descriptionOf(r),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Woofers//Appointments//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(business.name)}`,
    `X-WR-TIMEZONE:${business.timezone}`,
  ];
  for (const r of rows) {
    const title = titleOf(r);
    const description = descriptionOf(r);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.id}@woofers`,
      `DTSTAMP:${stamp(r.updated_at)}`,
      `DTSTART:${stamp(r.start_at)}`,
      `DTEND:${stamp(r.end_at)}`,
      `SUMMARY:${esc(title)}`,
      ...(r.address_line ? [`LOCATION:${esc(r.address_line)}`] : []),
      `DESCRIPTION:${esc(description)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" },
  });
}
