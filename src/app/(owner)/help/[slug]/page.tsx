import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { helpArticle, helpArticles, topicName } from "@/lib/help/articles";
import { Card, Page, PageHeader } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { lang } = await getOwnerI18n();
  return { title: helpArticle((await params).slug, lang)?.title ?? "Help" };
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { t, lang } = await getOwnerI18n();
  await requireStaff();
  const a = helpArticle((await params).slug, lang);
  if (!a) notFound();
  const related = helpArticles(lang).filter((x) => x.topic === a.topic && x.slug !== a.slug);
  return (
    <>
      <PageHeader title={t("Help")} back="/help" />
      <Page>
        <div>
          <p className="section-label">{topicName(a.topic, lang)}</p>
          <h1 className="text-2xl font-extrabold">{a.title}</h1>
          <p className="mt-1 text-muted">{a.summary}</p>
        </div>
        <Card>
          <ol className="space-y-3">
            {a.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </Card>
        {a.tips?.map((tip) => <p key={tip} className="rounded-xl bg-[#fdf3d7] px-4 py-3 text-sm">💡 {tip}</p>)}
        {related.length > 0 && (
          <section className="space-y-2">
            <h2 className="section-label">{t("More on this")}</h2>
            <ul className="card divide-y divide-line overflow-hidden">
              {related.map((r) => (
                <li key={r.slug}><Link href={`/help/${r.slug}`} className="block px-4 py-3 font-semibold hover:bg-bg">{r.title} ›</Link></li>
              ))}
            </ul>
          </section>
        )}
        <p className="text-center"><Link href="/help" className="font-semibold text-brand">{t("Still stuck? Ask the assistant")} ›</Link></p>
      </Page>
    </>
  );
}
