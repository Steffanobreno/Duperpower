import Link from "next/link";
import { adminOverview } from "@/lib/data/admin";
import { money } from "@/lib/format";
import { regionOf } from "@/lib/region";
import { countryName } from "@/lib/countries";

const n = (v: number) => v.toLocaleString("pt-BR");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

function Stat({ label, value, hint, href, tone }: { label: string; value: string; hint?: string; href?: string; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : tone === "warn" ? "text-[#7d5f10]" : "text-ink";
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </>
  );
  return href
    ? <Link href={href} className="card block p-4 hover:bg-bg">{body}</Link>
    : <div className="card p-4">{body}</div>;
}

export default async function AdminHome() {
  const o = await adminOverview();
  const maxWeek = Math.max(1, ...o.weekly.map((w) => w.signups));
  const growth = o.prevMonth ? Math.round(((o.month - o.prevMonth) / o.prevMonth) * 100) : null;
  return (
    <>
      <h1 className="text-2xl font-extrabold">Visão geral</h1>

      <section aria-label="Receita" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Receita mensal (MRR)"
          value={o.mrr.length ? o.mrr.map((m) => money(m.cents, regionOf("US", m.currency, "pt"))).join(" + ") : "—"}
          hint="Planos anuais contam 1/12 por mês" tone="good" />
        <Stat label="Pagando" value={n(o.active)} href="/admin/businesses?f=active" tone="good" />
        <Stat label="Pagamento atrasado" value={n(o.pastDue)} href="/admin/businesses?f=past_due" tone={o.pastDue ? "bad" : undefined} />
        <Stat label="Cancelaram (30 dias)" value={n(o.cancelledMonth)} hint={`${n(o.cancelled)} no total`} href="/admin/businesses?f=cancelled" tone={o.cancelledMonth ? "bad" : undefined} />
      </section>

      <section aria-label="Cadastros" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Negócios no total" value={n(o.total)} href="/admin/businesses" />
        <Stat label="Novos hoje" value={n(o.today)} href="/admin/businesses?f=new" />
        <Stat label="Novos em 7 dias" value={n(o.week)} href="/admin/businesses?f=new" />
        <Stat label="Novos em 30 dias" value={n(o.month)}
          hint={growth == null ? "sem mês anterior para comparar" : `${growth >= 0 ? "+" : ""}${growth}% vs. 30 dias antes`}
          tone={growth != null && growth < 0 ? "bad" : undefined} />
      </section>

      <section aria-labelledby="funnel" className="card space-y-3 p-4">
        <h2 id="funnel" className="font-bold">Funil dos cadastros (últimos 30 dias)</h2>
        <ol className="grid gap-2 sm:grid-cols-5">
          {([
            ["Cadastraram", o.funnel.signups, o.funnel.signups],
            ["Passaram da configuração", o.funnel.setUp, o.funnel.signups],
            ["Marcaram a 1ª visita", o.funnel.firstVisit, o.funnel.setUp],
            ["Escolheram um plano", o.funnel.chosePlan, o.funnel.firstVisit],
            ["Pagando agora", o.funnel.paying, o.funnel.chosePlan],
          ] as const).map(([label, v, prev], i) => (
            <li key={label} className="rounded-xl bg-bg p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
              <p className="text-2xl font-extrabold tabular-nums">{n(v)}</p>
              {i > 0 && <p className="text-xs text-muted">{pct(v, prev)} da etapa anterior</p>}
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Teste grátis e uso" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Em teste grátis" value={n(o.trial)} hint={`${n(o.trialEndingSoon)} terminam em 3 dias`} href="/admin/businesses?f=trial" tone="warn" />
        <Stat label="Teste vencido sem pagar" value={n(o.trialExpired)} href="/admin/businesses?f=trial" tone={o.trialExpired ? "bad" : undefined} />
        <Stat label="Usaram o app em 7 dias" value={n(o.activeWeek)} hint={`${pct(o.activeWeek, o.total)} dos negócios`} />
        <Stat label="Em risco" value={n(o.atRisk)} hint="Sem abrir o app há 14 dias" href="/admin/businesses?f=risk" tone={o.atRisk ? "bad" : undefined} />
      </section>

      <section aria-label="Conversão" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Ativados" value={pct(o.activated, o.total)} hint={`${n(o.activated)} já agendaram uma visita`} />
        <Stat label="Viraram pagantes" value={pct(o.active, o.active + o.cancelled + o.trialExpired)} hint="de quem já saiu do teste" />
        <Stat label="Grátis (cortesia)" value={n(o.free)} href="/admin/businesses?f=free" />
      </section>

      <section className="card p-4">
        <h2 className="font-bold">Cadastros por semana</h2>
        <div className="mt-4 flex h-40 items-end gap-1.5" role="img"
          aria-label={o.weekly.map((w) => `${w.week}: ${w.signups}`).join(", ")}>
          {o.weekly.map((w) => (
            <div key={w.week} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] font-semibold tabular-nums text-muted">{w.signups || ""}</span>
              <div className="w-full rounded-t-md bg-brand" style={{ height: `${Math.max(2, (w.signups / maxWeek) * 120)}px` }} />
              <span className="text-[10px] text-muted">{w.week.slice(8, 10)}/{w.week.slice(5, 7)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="card p-4">
          <h2 className="font-bold">Países</h2>
          <ul className="mt-2 divide-y divide-line text-sm">
            {o.countries.map((c) => (
              <li key={c.country} className="flex justify-between py-1.5"><span>{countryName(c.country, "pt")}</span><span className="tabular-nums">{n(c.n)}</span></li>
            ))}
          </ul>
        </section>
        <section className="card p-4">
          <h2 className="font-bold">De onde vieram (90 dias)</h2>
          <ul className="mt-2 divide-y divide-line text-sm">
            {o.sources.map((s) => (
              <li key={s.source} className="flex justify-between gap-3 py-1.5"><span className="truncate">{s.source}</span><span className="tabular-nums">{n(s.n)}</span></li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Use links com ?utm_source=instagram (ou ?ref=nome) para saber de onde cada cadastro veio.</p>
        </section>
      </div>
    </>
  );
}
