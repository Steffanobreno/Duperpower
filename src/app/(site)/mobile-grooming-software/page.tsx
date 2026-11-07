import type { Metadata } from "next";
import { mobileCopy, siteChrome } from "../../site-copy";
import { pageLang, siteMetadata } from "../../site-chrome";
import { TopicView } from "../topic-view";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const PATH = "/mobile-grooming-software";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const lang = await pageLang(searchParams);
  return siteMetadata(PATH, lang, mobileCopy(lang).meta);
}

export default async function MobilePage({ searchParams }: Props) {
  const lang = await pageLang(searchParams);
  const f = siteChrome(lang).footer;
  const related = [
    { href: "/features", label: f.features }, { href: "/pricing", label: f.pricing }, { href: "/mobile-grooming-software", label: f.mobile },
    { href: "/mobile-grooming-route-planner", label: f.route }, { href: "/switch", label: f.switch },
  ].filter((r) => r.href !== PATH);
  return <TopicView t={mobileCopy(lang)} lang={lang} path={PATH} related={related} />;
}
