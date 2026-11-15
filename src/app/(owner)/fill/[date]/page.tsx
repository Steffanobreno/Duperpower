import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { dayGaps, fillCandidates, gapOfferText } from "@/lib/data/fill-gap";
import { isRealYmd, longDayLabel, timeLabel, todayYmd, zonedToUtc } from "@/lib/format";
import { Empty, Notice, Page, PageHeader } from "@/components/ui";
import { SendFromPhone } from "@/components/send-from-phone";
import { RecordOffer } from "../record-offer";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Fill the gap") };
}

export default async function FillGapPage({ params }: PageProps<"/fill/[date]">) {
  const staff = await requireStaff();
  const { date } = await params;
  if (!isRealYmd(date)) notFound();
  const { t } = await getOwnerI18n();
  const tz = staff.timezone;
  const at = (time: string) => timeLabel(zonedToUtc(date, time, tz), tz);
  // A day that has passed has nothing to fill, and nobody to invite.
  const past = date < todayYmd(tz);
  const gaps = past ? [] : await dayGaps(staff, date);
  // Ranked for the time offered (the first gap): who fits it within the drive limit first.
  const candidates = gaps.length ? await fillCandidates(staff, date, 30, gaps[0]) : [];
  // Phone numbers (in the WhatsApp and text links) only for those allowed to see them.
  const canSend = staff.can.client_contact;
  const offer = canSend && gaps.length ? await gapOfferText(staff, date, gaps[0].start) : null;

  return (
    <>
      <PageHeader title={t("Fill {day}", { day: longDayLabel(zonedToUtc(date, "12:00", tz), tz) })} back={`/today?date=${date}`} />
      <Page>
        <section className="space-y-2" aria-label={t("Free time")}>
          <h2 className="section-label px-1">{t("Free time")}</h2>
          {gaps.length === 0 ? (
            <Empty title={t("No free time this day.")} />
          ) : (
            <ul className="flex flex-wrap gap-2">
              {gaps.map((g) => (
                <li key={g.start} className="rounded-full bg-brand-soft px-3 py-1.5 text-sm font-bold text-brand-strong">
                  {`${at(g.start)}–${at(g.end)}`}
                </li>
              ))}
            </ul>
          )}
        </section>

        {gaps.length > 0 && (
          <section className="space-y-2" aria-label={t("Who to invite")}>
            <h2 className="section-label px-1">{t("Who to invite")}</h2>
            {canSend && !offer && (
              <Notice kind="warn">
                {t("The gap offer message is off.")}{" "}
                <Link href="/settings/messages" className="font-semibold underline">{t("Turn it on in Texts and email")}</Link>
              </Notice>
            )}
            {candidates.length === 0 ? (
              <Empty title={t("No one to invite yet.")} />
            ) : (
              <ul className="space-y-2">
                {candidates.map((c) => (
                  <li key={c.clientId} className={`card space-y-3 p-4 ${c.overLimit != null ? "opacity-60" : ""}`} data-client={c.clientId}
                    data-over-limit={c.overLimit != null ? "" : undefined}>
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/clients/${c.clientId}`} className="min-w-0">
                        <span className="block font-bold">{c.name}</span>
                        <span className="block truncate text-sm text-muted">
                          {[c.pets,
                            c.reason === "waitlist" ? t("On the waitlist")
                              : c.daysOverdue != null && c.daysOverdue > 0 ? t("{n} days overdue", { n: c.daysOverdue }) : t("Due soon"),
                          ].filter(Boolean).join(" · ")}
                        </span>
                      </Link>
                      {c.overLimit != null ? (
                        <span className="shrink-0 text-sm font-semibold text-danger">{t("~{n} min — over your limit", { n: c.overLimit })}</span>
                      ) : (
                        <span className="shrink-0 text-sm text-muted">
                          {c.driveMinutes != null ? t("~{n} min", { n: c.driveMinutes }) : t("No address on the map")}
                        </span>
                      )}
                    </div>
                    {c.offeredToday && (
                      <p className="text-sm font-semibold text-success">{t("Invited today")}</p>
                    )}
                    {offer && c.phone && (
                      <RecordOffer clientId={c.clientId} date={date}>
                        <div className="grid grid-cols-2 gap-2 text-sm font-bold">
                          <SendFromPhone phone={c.phone} text={offer(c)} smsAllowed={c.smsOk} t={t} />
                        </div>
                      </RecordOffer>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </Page>
    </>
  );
}
