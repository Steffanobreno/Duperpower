import Link from "next/link";
import { adminBusinesses, type AdminFilter } from "@/lib/data/admin";
import { countryName } from "@/lib/countries";
import { ago, PlanBadge } from "../status";

const FILTERS: [AdminFilter, string][] = [
  ["all", "Todos"], ["new", "Novos (7 dias)"], ["trial", "Teste grátis"], ["active", "Pagando"],
  ["past_due", "Atrasados"], ["risk", "Em risco"], ["cancelled", "Cancelados"], ["free", "Cortesia"],
];

export default async function AdminBusinesses({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const f = (FILTERS.find(([k]) => k === sp.f)?.[0] ?? "all") as AdminFilter;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const list = await adminBusinesses(f, q);
  const href = (k: AdminFilter) => `/admin/businesses?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  return (
    <>
      <h1 className="text-2xl font-extrabold">Negócios</h1>
      <form className="flex gap-2">
        <input type="hidden" name="f" value={f} />
        <input name="q" defaultValue={q} placeholder="Buscar por nome, e-mail ou link" aria-label="Buscar"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5" />
        <button className="rounded-xl bg-navy px-4 font-semibold text-white">Buscar</button>
      </form>
      <nav aria-label="Filtro" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={href(k)} aria-current={f === k ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${f === k ? "border-navy bg-navy text-white" : "border-line bg-surface"}`}>
            {label}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-muted">{list.length === 200 ? "Mostrando os 200 mais recentes" : `${list.length} negócio${list.length === 1 ? "" : "s"}`}</p>
      {list.length ? (
        <ul className="card divide-y divide-line overflow-hidden">
          {list.map((b) => (
            <li key={b.id}>
              <Link href={`/admin/b/${b.id}`} className="grid gap-1 px-4 py-3 hover:bg-bg sm:grid-cols-[1fr_auto] sm:items-center">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{b.name}</span>
                  <span className="block truncate text-sm text-muted">{[b.owner, b.email, countryName(b.country, "pt")].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted sm:justify-end">
                  <PlanBadge status={b.plan_status} expired={b.trial_expired} />
                  <span>cadastro {b.created_at.toLocaleDateString("pt-BR")}</span>
                  <span>usou {ago(b.last_active_at)}</span>
                  <span>{b.clients} clientes · {b.visits30} visitas/30d</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="card p-6 text-center text-muted">Nenhum negócio aqui.</p>}
    </>
  );
}
