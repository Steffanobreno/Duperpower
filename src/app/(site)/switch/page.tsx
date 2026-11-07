import type { Metadata } from "next";
import { switchCopy, siteChrome } from "../../site-copy";
import { pageLang, siteMetadata } from "../../site-chrome";
import { TopicView } from "../topic-view";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const PATH = "/switch";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const lang = await pageLang(searchParams);
  return siteMetadata(PATH, lang, switchCopy(lang).meta, switchCopy(lang).shot);
}

export default async function SwitchPage({ searchParams }: Props) {
  const lang = await pageLang(searchParams);
  const f = siteChrome(lang).footer;
  const related = [
    { href: "/features", label: f.features }, { href: "/pricing", label: f.pricing }, { href: "/mobile-grooming-software", label: f.mobile },
    { href: "/mobile-grooming-route-planner", label: f.route }, { href: "/switch", label: f.switch },
  ].filter((r) => r.href !== PATH);
  return <TopicView t={switchCopy(lang)} lang={lang} path={PATH} related={related} />;
}
