import type { Metadata } from "next";
import Link from "next/link";
import { topicName } from "@/lib/help/articles";
import { guidesCopy, pricingCopy, siteChrome } from "../../site-copy";
import { Hero, JsonLd, SitePage, heading, hrefFor, pageLang, siteMetadata } from "../../site-chrome";
import { GUIDE_TOPICS, publicGuides } from "./public-guides";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const PATH = "/guides";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const lang = await pageLang(searchParams);
  return siteMetadata(PATH, lang, guidesCopy(lang).meta);
}

// Every public guide, by topic.
export default async function GuidesPage({ searchParams }: Props) {
  const lang = await pageLang(searchParams);
  const g = guidesCopy(lang);
  const c = siteChrome(lang);
  const guides = publicGuides(lang);
  return (
    <SitePage lang={lang} path={PATH} closerNote={pricingCopy(lang).trial}>
      <JsonLd path={PATH} lang={lang} name={g.kicker} home={c.home} />
      <Hero kicker={g.kicker} title={g.title} sub={g.sub} lang={lang} c={c} />
      <section className="bg-[#faf8f7] px-4 py-16 sm:py-20">
        <div className="mx-auto grid max-w-[1100px] gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDE_TOPICS.map((topic) => {
            const list = guides.filter((a) => a.topic === topic.key);
            if (!list.length) return null;
            return (
              <div key={topic.key}>
                <h2 className={`${heading} !text-[22px]`}>{topicName(topic.key, lang)}</h2>
                <ul className="mt-4 space-y-2">
                  {list.map((a) => (
                    <li key={a.slug}>
                      <Link href={hrefFor(`/guides/${a.slug}`, lang)} className="block rounded-2xl bg-white p-4 hover:shadow-md" style={{ boxShadow: "0 0 0 1px rgba(0,0,0,.05)" }}>
                        <span className="block text-[16px] font-semibold">{a.title}</span>
                        <span className="mt-1 block text-[14px] leading-snug text-[#555]">{a.summary}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </SitePage>
  );
}
