import { sql } from "@/lib/db";
import { businessForDeviceKey } from "@/lib/device";

// iCalendar feed. In Google Calendar: Other calendars → From URL → paste this link.
// Google refreshes subscribed calendars on its own schedule (usually every few hours).

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
  const business = await businessForDeviceKey(new URL(request.url).searchParams.get("key"));
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
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Woofers//Appointments//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(business.name)}`,
    `X-WR-TIMEZONE:${business.timezone}`,
  ];
  for (const r of rows) {
    const title = `${r.status === "requested" ? "[Request] " : ""}${r.pets ?? "Grooming"} · ${r.client}`;
    const description = [r.services, r.phone, r.notes, appUrl && `${appUrl}/appointments/${r.id}`].filter(Boolean).join("\n");
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
