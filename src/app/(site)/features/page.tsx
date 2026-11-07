import type { Metadata } from "next";
import { featuresCopy, pricingCopy, siteChrome } from "../../site-copy";
import { Hero, INDIGO, INK, JsonLd, pageLang, Phone, SitePage, heading, siteMetadata } from "../../site-chrome";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const PATH = "/features";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const lang = await pageLang(searchParams);
  return siteMetadata(PATH, lang, featuresCopy(lang).meta);
}

// Everything the app does, by part of the day, with the real screens.
export default async function FeaturesPage({ searchParams }: Props) {
  const lang = await pageLang(searchParams);
  const f = featuresCopy(lang);
  const c = siteChrome(lang);
  const trial = pricingCopy(lang).trial;
  return (
    <SitePage lang={lang} path={PATH} closerNote={trial}>
      <JsonLd path={PATH} lang={lang} name={f.kicker} home={c.home} />
      <Hero kicker={f.kicker} title={f.title} sub={f.sub} lang={lang} c={c} note={trial} />

      <section className="px-4 py-20 text-white sm:py-28" style={{ background: INDIGO }}>
        <div className="mx-auto max-w-[1100px] space-y-24 sm:space-y-32">
          {f.groups.map((g, i) => (
            <div key={g.title} className={g.shot ? `grid items-center gap-12 md:grid-cols-[1fr_1.3fr] ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}` : ""}>
              {g.shot && (
                <div className="relative">
                  <div aria-hidden className="absolute inset-x-8 inset-y-12 rounded-full blur-3xl"
                    style={{ background: "linear-gradient(180deg, rgb(18,0,54) 0%, rgb(37,1,96) 51%, rgb(18,0,54) 100%)" }} />
                  <div className="relative"><Phone src={g.shot} alt={g.alt ?? ""} /></div>
                </div>
              )}
              <div>
                <h2 className={heading}>{g.title}</h2>
                <ul className={`mt-8 grid gap-3 ${g.shot ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
                  {g.items.map((it) => (
                    <li key={it.t} className="rounded-2xl border border-white/[0.08] p-5" style={{ background: INK }}>
                      <h3 className="text-[17px] font-semibold">{it.t}</h3>
                      <p className="mt-1.5 text-[15px] leading-[1.5] text-[#cfcfcf]">{it.d}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>
    </SitePage>
  );
}
