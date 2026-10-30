import { formatInTimeZone } from "date-fns-tz";
import type { Receipt } from "@/lib/data/receipts";
import { money } from "@/lib/format";

/** A receipt on screen, laid out like the PDF: client, times, services by pet, totals, payments. */
export function ReceiptView({ r }: { r: Receipt }) {
  const tz = r.business.timezone;
  const when = (d: Date | null) => (d ? formatInTimeZone(d, tz, "EEE, MMM d · h:mm a") : "—");
  return (
    <div className="space-y-4">
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
        <img src="/logo.png" alt="" width={400} height={380} className="mx-auto h-20 w-auto" />
        <p className="mt-2 text-lg font-extrabold">{r.business.name}</p>
        <h1 className="mt-3 text-2xl font-extrabold">Receipt #{r.number}</h1>
        <p className={`mt-1 text-sm font-bold ${r.open ? "text-danger" : "text-success"}`}>{r.open ? "Balance due" : "Paid · Thank you!"}</p>
      </div>
      <dl className="divide-y divide-line rounded-2xl border border-line text-sm">
        {[
          ["Client", r.client.name],
          ["Date", formatInTimeZone(r.date, tz, "EEEE, MMMM d, yyyy")],
          ["Checked in", when(r.checkedIn)],
          ["Checked out", when(r.checkedOut)],
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
              <p key={i} className="flex justify-between gap-3"><span>{l.name}</span><span className="tabular-nums">{money(l.cents)}</span></p>
            ))}
          </div>
        ))}
        {r.adjustments.length > 0 && (
          <div className="space-y-1 px-4 py-3">
            {r.adjustments.map((a, i) => (
              <p key={i} className={`flex justify-between gap-3 ${a.kind === "discount" ? "text-success" : ""}`}>
                <span>{a.label}</span><span className="tabular-nums">{money(a.cents)}</span>
              </p>
            ))}
          </div>
        )}
        <dl className="space-y-1 px-4 py-3">
          <Row k="Subtotal" v={money(r.subtotal)} />
          {r.discount > 0 && <Row k="Discount" v={`−${money(r.discount)}`} />}
          {r.tax > 0 && <Row k="Tax" v={money(r.tax)} />}
          <Row k="Tips" v={money(r.tips)} />
          <Row k="Total" v={money(r.total)} strong />
          <Row k="Total paid" v={money(r.paid)} strong />
          {r.total > r.paid && <Row k="Balance due" v={money(r.total - r.paid)} strong />}
        </dl>
        {r.payments.length > 0 && (
          <div className="space-y-1 px-4 py-3">
            <p className="font-bold">Payments</p>
            {r.payments.map((p, i) => (
              <p key={i} className="flex justify-between gap-3 text-muted">
                <span>{p.method} · {formatInTimeZone(p.at, tz, "MMM d, h:mm a")}{p.tip ? ` (incl. ${money(p.tip)} tip)` : ""}</span>
                <span className="tabular-nums text-ink">{money(p.amount + p.tip)}</span>
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
