import Link from "next/link";
import { pricingCopy, siteChrome, type SiteLang } from "../site-copy";
import { BLUE, Hero, INDIGO, INK, JsonLd, Phone, Questions, SitePage, heading, hrefFor, localShot } from "../site-chrome";

type Topic = {
  kicker: string; title: string; sub: string; shot: string; alt: string;
  points: { t: string; d: string }[]; stepsTitle: string; steps: { t: string; d: string }[];
  faqTitle: string; faq: { q: string; a: string }[];
};

// A page about one subject (mobile grooming software, the route planner, switching apps):
// hero with the real screen, the points on the dark board, three steps, questions, links on.
export function TopicView({ t, lang, path, related }: { t: Topic; lang: SiteLang; path: string; related: { href: string; label: string }[] }) {
  const c = siteChrome(lang);
  const trial = pricingCopy(lang).trial;
  return (
    <SitePage lang={lang} path={path} closerNote={trial}>
      <JsonLd path={path} lang={lang} name={t.kicker} home={c.home} faq={t.faq} />
      <Hero kicker={t.kicker} title={t.title} sub={t.sub} lang={lang} c={c} note={trial}
        aside={<div><Phone src={localShot(t.shot, lang)} alt={t.alt} priority /></div>} />

      <section className="px-4 py-20 text-white sm:py-24" style={{ background: INDIGO }}>
        <ul className="mx-auto grid max-w-[1100px] gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {t.points.map((p) => (
            <li key={p.t} className="rounded-2xl border border-white/[0.08] p-6" style={{ background: INK }}>
              <h2 className="text-[19px] font-semibold">{p.t}</h2>
              <p className="mt-2 text-[15px] leading-[1.55] text-[#cfcfcf]">{p.d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-[1000px]">
          <h2 className={`text-center ${heading}`}>{t.stepsTitle}</h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            {t.steps.map((s, i) => (
              <li key={s.t} className="text-center sm:text-left">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[17px] font-bold text-white" style={{ background: BLUE }}>{i + 1}</span>
                <h3 className="mt-4 text-[19px] font-semibold">{s.t}</h3>
                <p className="mt-2 text-[15px] leading-[1.55] text-[#333]">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-[#faf8f7] px-4 py-16 sm:py-24">
        <Questions title={t.faqTitle} items={t.faq} />
        <nav aria-label={c.related} className="mx-auto mt-12 flex max-w-[760px] flex-wrap gap-2">
          {related.map((r) => (
            <Link key={r.href} href={hrefFor(r.href, lang)} className="rounded-full border border-black/15 bg-white px-4 py-2 text-[15px] font-semibold hover:border-black/40">{r.label} →</Link>
          ))}
        </nav>
      </section>
    </SitePage>
  );
}
