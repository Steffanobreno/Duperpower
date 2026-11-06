import Link from "next/link";
import { notFound } from "next/navigation";
import { adminBusiness } from "@/lib/data/admin";
import { isUuid, money } from "@/lib/format";
import { regionOf } from "@/lib/region";
import { countryName } from "@/lib/countries";
import { extendTrialAction, setPlanStatusAction } from "../../actions";
import { ago, PlanBadge, STATUS_LABEL } from "../../status";

export default async function AdminBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const b = await adminBusiness(id);
  if (!b) notFound();
  const rg = regionOf(b.country, b.currency, "pt");
  const date = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR") : "—");
  // How far they got in setting up: the steps that make the app useful.
  const steps = [
    ["Logo", b.logo], ["Serviços ativos", b.services > 0], ["Primeiro cliente", b.clients > 0],
    ["Primeira visita", b.visits > 0], ["Agendamento online usado", b.online > 0], ["Mensagens enviadas (30 dias)", b.messages30 > 0],
  ] as const;
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-3 py-1.5 text-sm"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
  );
  return (
    <>
      <Link href="/admin/businesses" className="text-sm font-semibold text-brand">‹ Negócios</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold">{b.name}</h1>
        <PlanBadge status={b.plan_status} expired={b.trial_expired} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <section className="card p-4">
          <h2 className="font-bold">Conta</h2>
          <dl className="mt-2 divide-y divide-line">
            {row("Dono", b.owner ?? "—")}
            {row("E-mail", b.email ? <a href={`mailto:${b.email}`} className="text-brand underline">{b.email}</a> : "—")}
            {row("Telefone", b.phone ?? "—")}
            {row("País", countryName(b.country, "pt"))}
            {row("Fuso / moeda", `${b.timezone} · ${b.currency}`)}
            {row("Página de agendamento", <a href={`/book/${b.booking_slug}`} className="text-brand underline">/book/{b.booking_slug}</a>)}
            {row("Cadastro", date(b.created_at))}
            {row("Veio de", b.signup_source || "direto")}
            {row("Último uso", ago(b.last_active_at))}
          </dl>
        </section>
        <section className="card p-4">
          <h2 className="font-bold">Plano</h2>
          <dl className="mt-2 divide-y divide-line">
            {row("Situação", STATUS_LABEL[b.plan_status])}
            {row("Teste grátis até", date(b.trial_ends_at))}
            {row("Valor", b.plan_amount_cents ? `${money(b.plan_amount_cents, regionOf(b.country, b.plan_currency ?? b.currency, "pt"))} / ${b.plan_interval === "year" ? "ano" : "mês"}` : "—")}
            {row("Cancelou em", date(b.cancelled_at))}
          </dl>
          <form action={extendTrialAction.bind(null, b.id)} className="mt-3 flex items-center gap-2">
            <label className="text-sm" htmlFor="days">Dar mais</label>
            <input id="days" name="days" type="number" min={1} max={90} defaultValue={14} className="w-20 rounded-lg border border-line px-2 py-1.5" />
            <span className="text-sm">dias de teste</span>
            <button className="ml-auto rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white">Dar</button>
          </form>
          <form action={setPlanStatusAction.bind(null, b.id)} className="mt-2 flex items-center gap-2">
            <label className="text-sm" htmlFor="status">Mudar para</label>
            <select id="status" name="status" defaultValue={b.plan_status} className="flex-1 rounded-lg border border-line px-2 py-1.5">
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="rounded-lg border border-navy px-3 py-1.5 text-sm font-semibold text-navy">Salvar</button>
          </form>
          <p className="mt-2 text-xs text-muted">Quando o Stripe estiver ligado, a situação muda sozinha com cada pagamento.</p>
        </section>
        <section className="card p-4">
          <h2 className="font-bold">Uso</h2>
          <dl className="mt-2 divide-y divide-line">
            {row("Equipe ativa", b.staff)}
            {row("Clientes / pets", `${b.clients} / ${b.pets}`)}
            {row("Visitas (total / 30 dias)", `${b.visits} / ${b.visits30}`)}
            {row("Agendamentos online", b.online)}
            {row("Recebido no app (30 dias)", money(b.collected30, rg))}
            {row("Mensagens enviadas (30 dias)", b.messages30)}
          </dl>
        </section>
        <section className="card p-4">
          <h2 className="font-bold">Configuração inicial</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {steps.map(([label, done]) => (
              <li key={label} className="flex items-center gap-2">
                <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${done ? "bg-success text-white" : "border border-line"}`}>{done ? "✓" : ""}</span>
                <span className={done ? "" : "text-muted"}>{label}</span>
                <span className="sr-only">{done ? "feito" : "ainda não"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">{steps.filter(([, d]) => d).length} de {steps.length} passos.</p>
        </section>
      </div>
    </>
  );
}
