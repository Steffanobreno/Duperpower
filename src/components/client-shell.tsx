import type { ReactNode } from "react";
import { Phone } from "./icons";
import { LanguagePicker } from "./i18n";
import type { Lang, T } from "@/lib/i18n";

// The frame around every page clients see (booking, confirm, cancel): the Woofers navy
// header and footer, like the website. `bare` drops both when the page sits inside the
// website in an iframe, which already has its own.

export function ClientShell({
  phone,
  phoneLabel,
  website,
  bare = false,
  i18n,
  children,
}: {
  phone: string | null;
  phoneLabel: string;
  website: string | null;
  bare?: boolean;
  /** The client's language: shows the language menu and translates the frame. */
  i18n?: { lang: Lang; t: T };
  children: ReactNode;
}) {
  const t: T = i18n?.t ?? ((s) => s);
  const picker = i18n && (
    <div className="mb-3">
      <LanguagePicker lang={i18n.lang} label={t("Language")} />
    </div>
  );
  if (bare) return <main lang={i18n?.lang} className="mx-auto w-full max-w-lg flex-1 px-3 py-4">{picker}{children}</main>;
  return (
    <>
      <header className="sticky top-0 z-20 bg-navy">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <a href={website ?? "#"} aria-label="Woofers Dog Spa home" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
            <img src="/logo-light.png" alt="Woofers Dog Spa" width={594} height={160} className="h-11 w-auto" />
          </a>
          {phone && (
            <a
              href={`sms:${phone}`}
              className="rounded-xl bg-sky px-4 py-2.5 text-sm font-bold text-navy shadow-[0_0_18px_rgb(25_178_230/0.35)]"
            >
              {t("Text us")}
            </a>
          )}
        </div>
      </header>
      <main lang={i18n?.lang} className="mx-auto w-full max-w-lg flex-1 px-3 py-5">{picker}{children}</main>
      <footer className="bg-navy-deep text-white/75">
        <div className="mx-auto max-w-lg space-y-4 px-5 py-8 text-sm">
          {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
          <img src="/logo-light.png" alt="" width={594} height={160} className="h-12 w-auto" />
          <p>{t("Premium mobile dog grooming delivered right to your doorstep in the Bay Area, CA.")}</p>
          {phone && (
            <a href={`tel:${phone}`} className="flex items-center gap-2 text-white">
              <Phone size={16} /> {phoneLabel}
            </a>
          )}
        </div>
      </footer>
    </>
  );
}

/** The white card each booking step sits in. */
export function StepCard({ children, className = "", flush = false }: { children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section
      className={`relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] ${flush ? "" : "p-5 sm:p-7"} ${className}`}
    >
      {children}
    </section>
  );
}
