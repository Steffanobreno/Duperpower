import { getOwnerI18n } from "@/lib/i18n/server";
import Link from "next/link";

export async function DayNav({
  base,
  prev,
  next,
  today,
  label,
  isToday,
}: {
  base: string;
  prev: string;
  next: string;
  today: string;
  label: string;
  isToday: boolean;
}) {
  const { t } = await getOwnerI18n();
  const link = "rounded-lg px-3 py-2 text-brand hover:bg-brand-soft";
  return (
    <nav aria-label={t("Change date")} className="flex items-center gap-1">
      <Link href={`${base}date=${prev}`} className={link} aria-label={t("Previous")}>
        ‹
      </Link>
      <span className="min-w-0 flex-1 truncate text-center font-semibold">{label}</span>
      <Link href={`${base}date=${next}`} className={link} aria-label={t("Next")}>
        ›
      </Link>
      {!isToday && (
        <Link href={`${base}date=${today}`} className={`${link} text-sm font-semibold`}>
          {t("Today")}
        </Link>
      )}
    </nav>
  );
}
