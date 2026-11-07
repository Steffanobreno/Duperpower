import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/product";
import { PLAN_PRICES } from "../../landing-copy";
import { pricingCopy, siteChrome } from "../../site-copy";
import { BLUE, JsonLd, Questions, SHADOW, SitePage, appUrl, display, heading, hrefFor, pageLang, pill, siteMetadata } from "../../site-chrome";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const PATH = "/pricing";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const lang = await pageLang(searchParams);
  return siteMetadata(PATH, lang, pricingCopy(lang).meta);
}

// The plan: one price for the whole business, what's in it, the referral and billing questions.
export default async function PricingPage({ searchParams }: Props) {
  const lang = await pageLang(searchParams);
  const p = pricingCopy(lang);
  const c = siteChrome(lang);
  const monthly = PLAN_PRICES.monthly ?? 29;
  const yearly = PLAN_PRICES.yearly ?? 290;
  const offers = {
    "@context": "https://schema.org", "@type": "SoftwareApplication", name: APP_NAME, applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android", url: `${appUrl()}${hrefFor(PATH, lang)}`, inLanguage: lang,
    offers: [
      { "@type": "Offer", name: p.monthly, price: String(monthly), priceCurrency: "USD", url: `${appUrl()}${hrefFor("/signup", lang)}`,
        priceSpecification: { "@type": "UnitPriceSpecification", price: monthly, priceCurrency: "USD", unitCode: "MON" } },
      { "@type": "Offer", name: p.yearly, price: String(yearly), priceCurrency: "USD", url: `${appUrl()}${hrefFor("/signup", lang)}`,
        priceSpecification: { "@type": "UnitPriceSpecification", price: yearly, priceCurrency: "USD", unitCode: "ANN" } },
    ],
  };
  return (
    <SitePage lang={lang} path={PATH} closerNote={p.trial}>
      <JsonLd path={PATH} lang={lang} name={c.nav.pricing} home={c.home} faq={p.faq} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(offers).replace(/</g, "\\u003c") }} />

      <section className="px-4 pb-16 pt-14 text-center sm:pt-20">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: BLUE }}>{c.nav.pricing}</p>
        <h1 className={`mx-auto mt-3 max-w-[820px] ${display}`}>{p.title}</h1>
        <p className="mx-auto mt-5 max-w-[580px] text-[17px] leading-[1.5] text-[#333]">{p.sub}</p>

        <div className="mx-auto mt-12 grid max-w-[720px] gap-4 text-left sm:grid-cols-2">
          {([[p.monthly, monthly, p.perMonth, null], [p.yearly, yearly, p.perYear, p.save]] as const).map(([name, price, per, badge]) => (
            <div key={name} className="flex flex-col rounded-[24px] bg-white p-7" style={{ boxShadow: SHADOW }}>
              <p className="flex min-h-[28px] items-center justify-between text-[15px] font-semibold text-[#333]">
                {name}
                {badge && <span className="rounded-full px-3 py-1 text-[12px] font-bold text-white" style={{ background: BLUE }}>{badge}</span>}
              </p>
              <p className="mt-3 text-[44px] font-bold leading-none tracking-[-0.025em]">US${price}<span className="text-[17px] font-medium text-[#737373]">{per}</span></p>
              <Link href={hrefFor("/signup", lang)} className={`${pill} mt-6 text-white`} style={{ background: BLUE }}>{p.cta}</Link>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-[#737373]">{p.trial}</p>
      </section>

      <section className="bg-[#faf8f7] px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-[860px]">
          <h2 className={`text-center ${heading}`}>{p.includedTitle}</h2>
          <ul className="mt-8 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {p.included.map((x) => (
              <li key={x} className="flex gap-3 text-[16px]"><span aria-hidden className="font-bold" style={{ color: BLUE }}>✓</span>{x}</li>
            ))}
          </ul>
          <div className="mt-12 rounded-[24px] bg-white p-7" style={{ boxShadow: SHADOW }}>
            <h2 className="text-[20px] font-bold">🎁 {p.referral.title}</h2>
            <p className="mt-2 text-[15px] leading-[1.6] text-[#333]">{p.referral.text}</p>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:py-24"><Questions title={p.faqTitle} items={p.faq} /></section>
    </SitePage>
  );
}
