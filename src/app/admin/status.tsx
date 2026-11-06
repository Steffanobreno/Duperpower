import type { PlanStatus } from "@/lib/data/admin";

export const STATUS_LABEL: Record<PlanStatus, string> = {
  trial: "Teste grátis", active: "Pagando", past_due: "Pagamento atrasado", cancelled: "Cancelado", free: "Cortesia",
};
const TONE: Record<PlanStatus, string> = {
  trial: "bg-[#fdf3d7] text-[#7a5b0c]", active: "bg-success-soft text-success", past_due: "bg-danger-soft text-danger",
  cancelled: "bg-bg text-muted", free: "bg-brand-soft text-brand",
};

export function PlanBadge({ status, expired = false }: { status: PlanStatus; expired?: boolean }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${expired ? "bg-danger-soft text-danger" : TONE[status]}`}>
      {expired ? "Teste vencido" : STATUS_LABEL[status]}
    </span>
  );
}

/** "hoje", "há 3 dias", "nunca". */
export function ago(d: Date | null) {
  if (!d) return "nunca";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? "hoje" : days === 1 ? "ontem" : `há ${days} dias`;
}
