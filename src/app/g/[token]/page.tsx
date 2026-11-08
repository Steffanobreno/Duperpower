import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getReportCard } from "@/lib/data/report-card";
import { GROOM_TAG_LABEL } from "@/lib/groom-tags";
import { longDayLabel, phoneLabel } from "@/lib/format";
import { regionForPage } from "@/lib/region-server";
import { tooManyFromHere } from "@/lib/rate-limit";
import { ClientShell, StepCard } from "@/components/client-shell";
import { referralCodeOf } from "@/lib/discounts";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Grooming report", robots: { index: false } };
export const dynamic = "force-dynamic";

// The pet's report card, from the link the groomer sends after the visit. The token is the only key.
export default async function ReportCardPage({ params, searchParams }: PageProps<"/g/[token]">) {
  const { token } = await params;
  const { lang, t } = await getI18n((await searchParams).lang);
  if (!/^[0-9a-f]{32}$/.test(token)) notFound();
  if (await tooManyFromHere("report-card", 120, 3_600_000)) {
    return (
      <ClientShell phone={null} phoneLabel="" website={null} i18n={{ lang, t }}>
        <StepCard><p>{t("Too many requests. Please try again later.")}</p></StepCard>
      </ClientShell>
    );
  }
  const r = await getReportCard(token);
  if (!r) notFound();
  const { business: b } = r;
  const nextDate = r.pets.map((p) => p.nextDate).filter((d): d is string => !!d).sort()[0];
  const book = new URLSearchParams();
  if (nextDate) book.set("date", nextDate);
  if (r.clientPhone) book.set("phone", r.clientPhone);
  book.set("lang", lang);
  const bookHref = `/book/${b.slug ?? ""}?${book}`;
  const region = regionForPage({ country: b.country, currency: b.currency }, lang);
  return (
    <ClientShell phone={b.phone} phoneLabel={phoneLabel(b.phone)} website={null} i18n={{ lang, t }}
      brand={{ name: b.name, logo: b.logo }} referralCode={await referralCodeOf(r.businessId)}>
      <StepCard>
        <h1 className="text-2xl font-extrabold">{t("Grooming report")}</h1>
        <p className="mt-1 text-muted">{longDayLabel(r.day, r.timezone, region)}</p>
        <div className="mt-5 space-y-6">
          {r.pets.map((p) => (
            <section key={p.petId} aria-label={p.name}>
              <h2 className="text-xl font-bold">{p.name}</h2>
              {p.groomId && p.hasPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/g/${token}/photo/${p.groomId}`} alt={t("{pet} after the groom", { pet: p.name })}
                  className="mt-3 w-full rounded-2xl object-cover" />
              )}
              {p.tags.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {p.tags.map((tag) => (
                    <li key={tag} className="rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand">{t(GROOM_TAG_LABEL[tag])}</li>
                  ))}
                </ul>
              )}
              {p.style && <p className="mt-3 font-semibold">{p.style}</p>}
              {p.note && <p className="mt-1 whitespace-pre-line text-muted">{p.note}</p>}
            </section>
          ))}
        </div>
        <div className="mt-6 grid gap-2">
          <a href={bookHref} className="rounded-full bg-brand py-3 text-center font-bold text-white">{t("Book the next one")}</a>
          {b.reviewUrl && (
            <a href={b.reviewUrl} target="_blank" rel="noopener noreferrer"
              className="rounded-full border-2 border-brand py-3 text-center font-bold text-brand">{t("Review us on Google")}</a>
          )}
        </div>
      </StepCard>
    </ClientShell>
  );
}
