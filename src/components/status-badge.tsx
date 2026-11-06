"use client";
import { useT } from "./i18n";
import { STATUS } from "./ui";

export function StatusBadge({ status }: { status: string }) {
  const { t } = useT();
  const s = STATUS[status] ?? { label: status, className: "bg-bg text-muted" };
  return <span className={`inline-block shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.className}`}>{t(s.label)}</span>;
}
