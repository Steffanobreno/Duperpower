"use client";
import { hasBuiltInArtwork } from "@/lib/product";
import { ShareReceiptButton } from "@/components/share-receipt";

/** The QR code poster: clients scan it to open the booking page. Share, save or print it. */
export function QrCard({ svg, name, logo, url }: { svg: string; name: string; logo: string | null; url: string }) {
  return (
    <div className="space-y-3">
      <div id="qr-poster" className="mx-auto max-w-xs rounded-3xl bg-navy p-5 text-center text-white">
        <p className="text-2xl font-extrabold tracking-tight">BOOK NOW</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          {logo || hasBuiltInArtwork(name) ? (
            // eslint-disable-next-line @next/next/no-img-element -- small logo
            <img src={logo ?? "/logo.png"} alt="" width={40} height={40} className="h-10 w-10 rounded-full bg-white object-contain p-0.5" />
          ) : null}
          <span className="font-bold">{name}</span>
        </div>
        <div className="mt-4 rounded-2xl bg-white p-3" role="img" aria-label={`QR code for ${url}`}
          dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-3 text-sm text-white/80">Scan with your phone camera</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <ShareReceiptButton pdfUrl="/settings/booking/qr" fileName="booking-qr-code.png" busyLabel="…" type="image/png"
          className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-brand">
          Share
        </ShareReceiptButton>
        <a href="/settings/booking/qr?download" className="rounded-xl border border-line bg-surface px-3 py-2.5 text-center text-sm font-semibold text-brand">
          Save image
        </a>
        <button type="button" onClick={() => window.print()} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-brand">
          Print
        </button>
      </div>
    </div>
  );
}
