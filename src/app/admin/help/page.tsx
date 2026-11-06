import Link from "next/link";
import { helpQuestions } from "@/lib/data/admin";

const FILTERS = [["all", "Todas"], ["people", "Pediram uma pessoa"], ["unhelpful", "Não ajudou"], ["unanswered", "Sem resposta"]] as const;

// What groomers ask the help assistant: what confuses people, and who asked for a person.
export default async function AdminHelp({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const f = (FILTERS.find(([k]) => k === sp.f)?.[0] ?? "all") as (typeof FILTERS)[number][0];
  const { rows, stats } = await helpQuestions(f);
  return (
    <>
      <h1 className="text-2xl font-extrabold">Suporte</h1>
      <section className="grid grid-cols-3 gap-3">
        <div className="card p-4"><p className="text-xs font-semibold uppercase text-muted">Perguntas (7 dias)</p><p className="text-3xl font-extrabold">{stats.week}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold uppercase text-muted">Pediram uma pessoa (30 dias)</p><p className="text-3xl font-extrabold">{stats.people}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold uppercase text-muted">Respostas que ajudaram</p><p className="text-3xl font-extrabold">{stats.rated ? `${Math.round((stats.helpful / stats.rated) * 100)}%` : "—"}</p></div>
      </section>
      <nav aria-label="Filtro" className="flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`/admin/help?f=${k}`} aria-current={f === k ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${f === k ? "border-navy bg-navy text-white" : "border-line bg-surface"}`}>{label}</Link>
        ))}
      </nav>
      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="card space-y-1 p-4 text-sm">
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <Link href={`/admin/b/${r.business_id}`} className="font-semibold text-brand">{r.business}</Link>
                {r.staff && <span>{r.staff}</span>}<span>{r.lang}</span><span>{r.created_at.toLocaleString("pt-BR")}</span>
                {r.escalated && <span className="rounded-full bg-danger-soft px-2 py-0.5 font-bold text-danger">pediu uma pessoa</span>}
                {r.helpful === true && <span>👍</span>}{r.helpful === false && <span>👎</span>}
              </p>
              <p className="font-semibold">{r.question}</p>
              {r.answer && <p className="whitespace-pre-line text-muted">{r.answer}</p>}
            </li>
          ))}
        </ul>
      ) : <p className="card p-6 text-center text-muted">Nenhuma pergunta aqui ainda.</p>}
    </>
  );
}
