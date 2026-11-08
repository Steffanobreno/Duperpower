import type { T } from "@/lib/i18n";
import { poweredByUrl } from "@/lib/powered-by";

export { poweredByUrl };

/** The small "Online booking by Fino" line at the bottom of client pages (the footer is navy: white/70 is AA). */
export function PoweredBy({ code, t }: { code: string; t: T }) {
  const [before, after] = t("Online booking by {fino} · free trial for groomers").split("{fino}");
  return (
    <p className="border-t border-white/10 pt-4 text-xs text-white/70">
      {before}
      <a href={poweredByUrl(code)} rel="noopener" className="font-semibold text-white underline underline-offset-2">Fino</a>
      {after}
    </p>
  );
}
