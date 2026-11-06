import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { hm, timeLabel, ymd } from "@/lib/format";
import type { RepeatRule } from "@/lib/repeat";
import { Page, PageHeader } from "@/components/ui";
import { saveRepeatAction, stopRepeatAction } from "../../repeat-actions";
import { RepeatForm } from "./repeat-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Repeat") };
}

export default async function RepeatPage({ params }: PageProps<"/appointments/[id]/repeat">) {
  const { t } = await getOwnerI18n();
  const staff = await requireStaff();
  const { id } = await params;
  const [a] = await sql<{ client_id: string; start_at: Date; series_id: string | null; freq: RepeatRule["freq"] | null; interval_n: number | null;
                         occurrences: number | null; ends_on: string | null; pet_days: number | null }[]>`
    select a.client_id, a.start_at, a.series_id, s.freq, s.interval_n, s.occurrences, to_char(s.ends_on, 'YYYY-MM-DD') as ends_on,
      (select min(p.rebook_every_days) from appointment_pets ap join pets p on p.id = ap.pet_id where ap.appointment_id = a.id) as pet_days
    from appointments a left join appointment_series s on s.id = a.series_id
    where a.id = ${id} and a.business_id = ${staff.businessId}`;
  if (!a) notFound();
  // A new repeat starts from the pet's usual frequency (in weeks) when we know it.
  const weeks = a.pet_days ? Math.min(Math.max(Math.round(a.pet_days / 7), 1), 12) : 4;
  // Days picked one by one: the later visits of the series are those days.
  const later = a.freq === "dates" && a.series_id ? await sql<{ d: string; t: string }[]>`
    select to_char(start_at at time zone ${staff.timezone}, 'YYYY-MM-DD') as d,
           to_char(start_at at time zone ${staff.timezone}, 'HH24:MI') as t from appointments
    where series_id = ${a.series_id} and start_at > ${a.start_at} and status not in ('cancelled', 'no_show', 'declined')
    order by start_at` : [];
  const initial: RepeatRule = a.freq === "dates"
    ? { freq: "dates", every: 1, count: null, until: null, dates: later.map((r) => r.d), times: Object.fromEntries(later.map((r) => [r.d, r.t])) }
    : a.freq
      ? { freq: a.freq, every: a.interval_n ?? 1, count: a.occurrences, until: a.ends_on }
      : { freq: "week", every: weeks, count: 10, until: null };
  return (
    <>
      <PageHeader title={t("Repeat")} back={`/appointments/${id}`} />
      <Page>
        <RepeatForm
          appointmentId={id}
          clientId={a.client_id}
          first={ymd(a.start_at, staff.timezone)}
          time={timeLabel(a.start_at, staff.timezone)}
          clock={hm(a.start_at, staff.timezone)}
          initial={initial}
          repeating={!!a.series_id}
          save={saveRepeatAction.bind(null, id)}
          stop={stopRepeatAction.bind(null, id)}
        />
      </Page>
    </>
  );
}
