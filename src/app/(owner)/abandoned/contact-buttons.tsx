"use client";
import { useT } from "@/components/i18n";
import { markContactedAction } from "./actions";

/** Text / Call that also mark the abandoned booking as contacted. */
export function ContactButtons({ id, phone, className = "" }: { id: string; phone: string; className?: string }) {
  const { t } = useT();
  const open = (href: string) => {
    void markContactedAction(id);
    window.location.href = href;
  };
  const btn = "rounded-xl border border-line bg-surface py-2.5 text-center text-sm font-semibold text-brand";
  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      <button type="button" className={btn} onClick={() => open(`sms:${phone}`)}>{t("Text")}</button>
      <button type="button" className={btn} onClick={() => open(`tel:${phone}`)}>{t("Call")}</button>
    </div>
  );
}
