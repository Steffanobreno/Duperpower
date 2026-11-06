import { hasBuiltInArtwork } from "@/lib/product";
import type { Receipt } from "@/lib/data/receipts";
import { money } from "@/lib/format";
import type { T } from "@/lib/i18n";

/**
 * A receipt on screen, laid out like the PDF: client, times, services by pet, totals, payments.
 * The client's page passes their language (t, locale); the owner's screens stay in English.
 */
export function ReceiptView({ r, t = (s) => s, locale = "en-US" }: { r: Receipt; t?: T; locale?: string }) {
  const rg = { ...r.region, locale: `${locale.split("-")[0]}-${r.region.country}` };
  const m = (cents: number) => money(cents, rg);
  const tz = r.business.timezone;
  const when = (d: Date | null) =>
    d ? `${d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric", timeZone: tz })} · ${d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", timeZone: tz })}` : "—";
  return (
    <div className="space-y-4">
      <div className="text-center">
        {(r.business.logo || hasBuiltInArtwork(r.business.name)) && (
          // eslint-disable-next-line @next/next/no-img-element -- small logo
          <img src={r.business.logo ?? "/logo.png"} alt="" width={400} height={380} className="mx-auto h-20 w-auto" />
        )}
        <p className="mt-2 text-lg font-extrabold">{r.business.name}</p>
        {(r.business.address || r.business.phone) && (
          <p className="text-xs text-muted">
            {[r.business.phone?.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3"), r.business.address].filter(Boolean).join(" · ")}
          </p>
        )}
        <h1 className="mt-3 text-2xl font-extrabold">{t("Receipt #{number}", { number: r.number })}</h1>
        <p className={`mt-1 text-sm font-bold ${r.open ? "text-danger" : "text-success"}`}>{r.open ? t("Balance due") : t("Paid · Thank you!")}</p>
      </div>
      <dl className="divide-y divide-line rounded-2xl border border-line text-sm">
        {[
          [t("Client"), r.client.name],
          [t("Date"), r.date.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: tz })],
          [t("Checked in"), when(r.checkedIn)],
          [t("Checked out"), when(r.checkedOut)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 px-4 py-2.5">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="divide-y divide-line rounded-2xl border border-line text-sm">
        {r.pets.map((p) => (
          <div key={p.name || "visit"} className="space-y-1 px-4 py-3">
            {p.name && <p className="font-bold">{p.name}</p>}
            {p.lines.map((l, i) => (
              <p key={i} className="flex justify-between gap-3"><span>{l.name}</span><span className="tabular-nums">{m(l.cents)}</span></p>
            ))}
          </div>
        ))}
        {r.adjustments.length > 0 && (
          <div className="space-y-1 px-4 py-3">
            {r.adjustments.map((a, i) => (
              <p key={i} className={`flex justify-between gap-3 ${a.kind === "discount" ? "text-success" : ""}`}>
                <span>{a.label}</span><span className="tabular-nums">{m(a.cents)}</span>
              </p>
            ))}
          </div>
        )}
        <dl className="space-y-1 px-4 py-3">
          <Row k={t("Subtotal")} v={m(r.subtotal)} />
          {r.discount > 0 && <Row k={t("Discount")} v={`−${m(r.discount)}`} />}
          {r.tax > 0 && <Row k={t("Tax")} v={m(r.tax)} />}
          <Row k={t("Tips")} v={m(r.tips)} />
          <Row k={t("Total")} v={m(r.total)} strong />
          <Row k={t("Total paid")} v={m(r.paid)} strong />
          {r.total > r.paid && <Row k={t("Balance due")} v={m(r.total - r.paid)} strong />}
        </dl>
        {r.payments.length > 0 && (
          <div className="space-y-1 px-4 py-3">
            <p className="font-bold">{t("Payments")}</p>
            {r.payments.map((p, i) => (
              <p key={i} className="flex justify-between gap-3 text-muted">
                <span>
                  {p.method} · {p.at.toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: tz })}{" "}
                  {p.at.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", timeZone: tz })}
                  {p.tip ? ` ${t("(incl. {amount} tip)", { amount: m(p.tip) })}` : ""}
                </span>
                <span className="tabular-nums text-ink">{m(p.amount + p.tip)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-bold" : ""}`}>
      <dt className={strong ? "" : "text-muted"}>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
