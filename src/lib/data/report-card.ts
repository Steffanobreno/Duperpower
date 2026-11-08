import "server-only";
import { sql } from "../db";
import { GROOM_TAGS, type GroomTag } from "../groom-tags";
import { addDaysYmd, todayYmd, ymd } from "../format";

// The report card a pet's owner opens from the link the groomer sends after a visit
// (/g/<token>): per pet the photo, what the groomer noticed, the cut, and when to rebook.
// The token is the only key.

export type ReportCard = {
  token: string;
  businessId: string;
  business: { name: string; phone: string | null; logo: string | null; slug: string | null; reviewUrl: string | null; country: string; currency: string };
  day: Date;
  timezone: string;
  clientPhone: string | null;
  pets: { petId: string; name: string; groomId: string | null; hasPhoto: boolean; tags: GroomTag[]; style: string | null; note: string | null; nextDate: string | null }[];
};

export const reportUrl = (token: string) => `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/g/${token}`;

/** The visit's report token; made the first time it is asked for and kept after. */
export async function ensureReportToken(businessId: string, appointmentId: string): Promise<string> {
  const [r] = await sql<{ report_token: string }[]>`
    update appointments set report_token = coalesce(report_token, encode(gen_random_bytes(16), 'hex'))
    where id = ${appointmentId} and business_id = ${businessId} returning report_token`;
  if (!r) throw new Error("Appointment not found");
  return r.report_token;
}

/** Whether the visit has anything to show: a photo, a note or a tag on any pet's cut. */
export async function reportHasContent(businessId: string, appointmentId: string): Promise<boolean> {
  const [r] = await sql`
    select 1 from pet_grooms g join appointment_pets ap on ap.id = g.appointment_pet_id
    join appointments a on a.id = ap.appointment_id
    where a.id = ${appointmentId} and a.business_id = ${businessId}
      and (g.photo is not null or nullif(btrim(g.note), '') is not null or cardinality(g.tags) > 0)
    limit 1`;
  return !!r;
}

export async function getReportCard(token: string): Promise<ReportCard | null> {
  const [a] = await sql<{
    id: string; business_id: string; start_at: Date; timezone: string; name: string; phone: string | null; slug: string;
    review_url: string | null; country: string; currency: string; client_phone: string | null; logo_v: string | null;
  }[]>`
    select a.id, a.business_id, a.start_at, b.timezone, b.name, b.phone, b.booking_slug as slug, b.review_url, b.country, b.currency,
           c.phone as client_phone,
           (select extract(epoch from l.updated_at)::bigint::text from business_logos l where l.business_id = b.id) as logo_v
    from appointments a join businesses b on b.id = a.business_id join clients c on c.id = a.client_id
    where a.report_token = ${token}`;
  if (!a) return null;
  const rows = await sql<{
    pet_id: string; name: string; groom_id: string | null; has_photo: boolean | null; tags: string[] | null;
    style: string | null; note: string | null; rebook: number | null;
  }[]>`
    select p.id as pet_id, p.name, g.id as groom_id, g.photo is not null as has_photo, g.tags, g.style, g.note,
           p.rebook_every_days as rebook
    from appointment_pets ap join pets p on p.id = ap.pet_id
    left join pet_grooms g on g.appointment_pet_id = ap.id
    where ap.appointment_id = ${a.id} order by p.name`;
  const visit = ymd(a.start_at, a.timezone);
  const today = todayYmd(a.timezone);
  return {
    token,
    businessId: a.business_id,
    business: {
      name: a.name, phone: a.phone, logo: a.logo_v ? `/logo/${a.business_id}?v=${a.logo_v}` : null,
      slug: a.slug, reviewUrl: a.review_url, country: a.country, currency: a.currency,
    },
    day: a.start_at,
    timezone: a.timezone,
    clientPhone: a.client_phone,
    pets: rows.map((r) => {
      const next = r.rebook ? addDaysYmd(visit, r.rebook) : null;
      return {
        petId: r.pet_id, name: r.name, groomId: r.groom_id, hasPhoto: r.has_photo ?? false,
        tags: (r.tags ?? []).filter((x): x is GroomTag => (GROOM_TAGS as readonly string[]).includes(x)),
        style: r.style, note: r.note,
        nextDate: next && next >= today ? next : null,
      };
    }),
  };
}
