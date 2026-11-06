import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { helpArticles, TOPICS, topicName } from "@/lib/help/articles";
import { assistantOn } from "@/lib/help/assistant";
import { Page, PageHeader } from "@/components/ui";
import { HelpChat, TalkToPerson } from "./help-chat";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Help") };
}

// The help center: the assistant on top, then every how-to article by topic, then a person.
export default async function HelpPage() {
  const { t, lang } = await getOwnerI18n();
  await requireStaff();
  const articles = helpArticles(lang);
  return (
    <>
      <PageHeader title={t("Help")} />
      <Page>
        <HelpChat available={assistantOn()} />
        {TOPICS.map((topic) => {
          const list = articles.filter((a) => a.topic === topic.key);
          if (!list.length) return null;
          return (
            <section key={topic.key} className="space-y-2">
              <h2 className="section-label">{topicName(topic.key, lang)}</h2>
              <ul className="card divide-y divide-line overflow-hidden">
                {list.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/help/${a.slug}`} className="block px-4 py-3 hover:bg-bg">
                      <span className="block font-semibold">{a.title}</span>
                      <span className="block text-sm text-muted">{a.summary}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <TalkToPerson />
      </Page>
    </>
  );
}
