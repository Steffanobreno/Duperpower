import { sql } from "@/lib/db";
import { billingOn } from "@/lib/billing";
import { REFERRAL_CENTS, timesRedeemed } from "@/lib/discounts";
import { CodeForm } from "./code-form";
import { deactivateCodeAction } from "./actions";

type Code = { id: string; code: string; stripe_promotion_code_id: string; percent_off: string | null; amount_off_cents: number | null;
  duration: string; duration_months: number | null; max_redemptions: number | null; expires_at: Date | null; note: string | null;
  active: boolean; created_at: Date };
type Ref = { referrer: string; referred: string; created_at: Date; rewarded_at: Date | null; plan_status: string };

const day = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR") : "");
const usd = (cents: number) => `US$${(cents / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;

// Discount codes (made here, used on the groomers' plan page or in Stripe Checkout) and referrals.
export default async function AdminCodes() {
  const [codes, refs, used] = await Promise.all([
    sql<Code[]>`select * from discount_codes order by active desc, created_at desc`,
    sql<Ref[]>`select a.name as referrer, b.name as referred, r.created_at, r.rewarded_at, b.plan_status
               from referrals r join businesses a on a.id = r.referrer_id join businesses b on b.id = r.referred_id
               order by r.created_at desc limit 200`,
    billingOn() ? timesRedeemed() : Promise.resolve(new Map<string, number>()),
  ]);
  return (
    <>
      <h1 className="text-2xl font-extrabold">Códigos e indicações</h1>
      {!billingOn() && <p className="card p-4 font-semibold text-danger">O Stripe ainda não está configurado: os códigos só podem ser criados depois de colocar STRIPE_SECRET_KEY no Netlify.</p>}

      <section aria-labelledby="new-code" className="space-y-2">
        <h2 id="new-code" className="text-lg font-bold">Novo código de desconto</h2>
        <p className="text-sm text-muted">O groomer digita o código na página do plano (ou no Stripe, na hora de pagar).</p>
        <CodeForm />
      </section>

      <section aria-labelledby="codes" className="space-y-2">
        <h2 id="codes" className="text-lg font-bold">Códigos</h2>
        {codes.length === 0 ? <p className="text-muted">Nenhum código ainda.</p> : (
          <div className="card divide-y divide-line">
            {codes.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3">
                <span className={`font-mono font-bold ${c.active ? "" : "text-muted line-through"}`}>{c.code}</span>
                <span className="text-sm">
                  {c.percent_off ? `${Number(c.percent_off)}%` : usd(c.amount_off_cents ?? 0)} ·{" "}
                  {c.duration === "once" ? "1ª cobrança" : c.duration === "forever" ? "para sempre" : `${c.duration_months} meses`}
                </span>
                <span className="text-sm text-muted">
                  {used.get(c.stripe_promotion_code_id) ?? 0}{c.max_redemptions ? `/${c.max_redemptions}` : ""} usos
                  {c.expires_at ? ` · até ${day(c.expires_at)}` : ""}{c.note ? ` · ${c.note}` : ""}
                </span>
                {c.active ? (
                  <form action={deactivateCodeAction.bind(null, c.id)} className="ml-auto">
                    <button type="submit" className="text-sm font-semibold text-danger">Desativar</button>
                  </form>
                ) : <span className="ml-auto text-sm text-muted">desativado</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="refs" className="space-y-2">
        <h2 id="refs" className="text-lg font-bold">Indicações</h2>
        <p className="text-sm text-muted">
          Quem foi indicado ganha o 1º mês grátis ({usd(REFERRAL_CENTS)} de desconto). Quem indicou ganha {usd(REFERRAL_CENTS)} de crédito
          quando o indicado paga a 1ª cobrança. Cada groomer vê o próprio link na página do plano.
        </p>
        {refs.length === 0 ? <p className="text-muted">Nenhuma indicação ainda.</p> : (
          <div className="card divide-y divide-line">
            {refs.map((r, i) => (
              <div key={i} className="flex flex-wrap gap-x-4 gap-y-1 p-3 text-sm">
                <span><b>{r.referrer}</b> indicou <b>{r.referred}</b></span>
                <span className="text-muted">em {day(r.created_at)} · plano: {r.plan_status}</span>
                <span className={`ml-auto font-semibold ${r.rewarded_at ? "text-success" : "text-muted"}`}>
                  {r.rewarded_at ? `crédito dado em ${day(r.rewarded_at)}` : "aguardando 1º pagamento"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
