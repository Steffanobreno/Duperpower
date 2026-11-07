import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { topicName } from "@/lib/help/articles";
import { APP_NAME } from "@/lib/product";
import { guidesCopy, pricingCopy, siteChrome } from "../../../site-copy";
import { BLUE, SitePage, appUrl, hrefFor, pageLang, siteMetadata } from "../../../site-chrome";
import { publicGuide, publicGuides } from "../public-guides";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, lang] = await Promise.all([params, pageLang(searchParams)]);
  const a = publicGuide(slug, lang);
  if (!a) return { title: guidesCopy(lang).kicker, robots: { index: false } };
  const description = `${a.summary} ${a.steps[0]}`.slice(0, 200).replace(/\s+\S*$/, "…");
  return siteMetadata(`/guides/${slug}`, lang, { title: `${a.title} (${guidesCopy(lang).kicker})`, description });
}

// One how-to guide: the steps, the tips, and the other guides on the same topic.
export default async function GuidePage({ params, searchParams }: Props) {
  const [{ slug }, lang] = await Promise.all([params, pageLang(searchParams)]);
  const a = publicGuide(slug, lang);
  if (!a) notFound();
  const g = guidesCopy(lang);
  const c = siteChrome(lang);
  const path = `/guides/${slug}`;
  const more = publicGuides(lang).filter((x) => x.topic === a.topic && x.slug !== a.slug);
  const url = (p: string) => `${appUrl()}${hrefFor(p, lang)}`;
  const ld = [
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: c.home, item: url("/") },
        { "@type": "ListItem", position: 2, name: g.kicker, item: url("/guides") },
        { "@type": "ListItem", position: 3, name: a.title, item: url(path) },
      ],
    },
    {
      "@context": "https://schema.org", "@type": "HowTo", name: a.title, description: a.summary, inLanguage: lang,
      step: a.steps.map((text, i) => ({ "@type": "HowToStep", position: i + 1, text })),
      tool: { "@type": "HowToTool", name: APP_NAME },
    },
  ];
  return (
    <SitePage lang={lang} path={path} closerNote={pricingCopy(lang).trial}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <article className="px-4 pb-16 pt-12 sm:pt-16">
        <div className="mx-auto max-w-[720px]">
          <nav aria-label="Breadcrumb" className="text-[14px] text-[#555]">
            <Link href={hrefFor("/guides", lang)} className="font-semibold hover:underline" style={{ color: BLUE }}>{g.kicker}</Link>
            <span aria-hidden> · </span>{topicName(a.topic, lang)}
          </nav>
          <h1 className="mt-3 text-[34px] font-bold leading-[1.1] tracking-[-0.025em] sm:text-[44px] [text-wrap:balance]">{a.title}</h1>
          <p className="mt-4 text-[18px] leading-[1.5] text-[#333]">{a.summary}</p>

          <h2 className="mt-10 text-[20px] font-bold">{g.steps}</h2>
          <ol className="mt-4 space-y-4">
            {a.steps.map((s, i) => (
              <li key={i} className="flex gap-4">
                <span aria-hidden className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white" style={{ background: BLUE }}>{i + 1}</span>
                <p className="text-[17px] leading-[1.6]">{s}</p>
              </li>
            ))}
          </ol>

          {a.tips?.length ? (
            <aside aria-label={g.tips} className="mt-10 rounded-2xl bg-[#faf8f7] p-5">
              <h2 className="text-[17px] font-bold">💡 {g.tips}</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[16px] leading-[1.6]">{a.tips.map((t) => <li key={t}>{t}</li>)}</ul>
            </aside>
          ) : null}

          {more.length > 0 && (
            <nav aria-label={g.more} className="mt-12">
              <h2 className="text-[17px] font-bold">{g.more}</h2>
              <ul className="mt-3 space-y-2">
                {more.map((m) => (
                  <li key={m.slug}><Link href={hrefFor(`/guides/${m.slug}`, lang)} className="font-semibold hover:underline" style={{ color: BLUE }}>{m.title} →</Link></li>
                ))}
              </ul>
            </nav>
          )}
          <p className="mt-8"><Link href={hrefFor("/guides", lang)} className="font-semibold hover:underline" style={{ color: BLUE }}>← {g.all}</Link></p>
        </div>
      </article>
    </SitePage>
  );
}
