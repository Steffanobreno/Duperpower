import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { getLang } from "@/lib/i18n/server";
import { APP_NAME } from "@/lib/product";
import { Landing } from "./landing";
import { LANDING_LANGS, landingCopy, PLAN_PRICES } from "./landing-copy";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function pick(searchParams: Props["searchParams"]) {
  const sp = await searchParams;
  return landingCopy(await getLang(sp.lang));
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { lang, c } = await pick(searchParams);
  const url = `${appUrl()}/${lang === "en" ? "" : `?lang=${lang}`}`;
  return {
    title: { absolute: `${APP_NAME} · ${c.meta.title}` },
    description: c.meta.description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LANDING_LANGS.map((l) => [l, `${appUrl()}/${l === "en" ? "" : `?lang=${l}`}`])),
        "x-default": `${appUrl()}/`,
      },
    },
    openGraph: { title: `${APP_NAME} · ${c.meta.title}`, description: c.meta.description, url, type: "website", images: ["/landing/today.png"] },
  };
}

// The sales page for groomers who aren't logged in; the app's Today for those who are.
export default async function Home({ searchParams }: Props) {
  if (await getStaff()) redirect("/today");
  const { lang, c } = await pick(searchParams);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: APP_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      description: c.meta.description,
      // The real plan prices (the free trial is in the description), so search and AI answers quote them right.
      offers: [
        PLAN_PRICES.monthly && { "@type": "Offer", name: "Monthly", price: String(PLAN_PRICES.monthly), priceCurrency: "USD",
          priceSpecification: { "@type": "UnitPriceSpecification", price: PLAN_PRICES.monthly, priceCurrency: "USD", unitCode: "MON" }, description: c.hero.note },
        PLAN_PRICES.yearly && { "@type": "Offer", name: "Yearly", price: String(PLAN_PRICES.yearly), priceCurrency: "USD",
          priceSpecification: { "@type": "UnitPriceSpecification", price: PLAN_PRICES.yearly, priceCurrency: "USD", unitCode: "ANN" } },
      ].filter(Boolean),
      url: `${appUrl()}/`,
      inLanguage: lang,
    },
    { "@context": "https://schema.org", "@type": "Organization", name: APP_NAME, url: `${appUrl()}/`, logo: `${appUrl()}/icon.png` },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: c.faq.items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Landing c={c} lang={lang} />
    </>
  );
}
