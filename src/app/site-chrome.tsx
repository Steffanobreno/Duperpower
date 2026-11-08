import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { getLang } from "@/lib/i18n/server";
import { APP_NAME } from "@/lib/product";
import { SITE_LANGS, siteChrome, siteLang, type SiteChrome, type SiteLang } from "./site-copy";

// The public site's shared pieces: the floating nav, the footer with every page and language,
// the closing call, questions, and each page's metadata (canonical, hreflang, Open Graph) and
// structured data. Same visual language as the home page (landing.tsx).

export const INDIGO = "#0d0021";
export const INK = "#05010d";
export const BLUE = "#0066d6"; // 5.4:1 with white text (WCAG AA)
export const AMBER = "#f7be00";
export const SHADOW =
  "0 0 0 1px rgba(0,0,0,.04), 0 1px 1px .5px rgba(0,0,0,.02), 0 3px 3px 1.5px rgba(0,0,0,.02), 0 6px 6px -3px rgba(0,0,0,.02), 0 12px 12px -6px rgba(0,0,0,.02), 0 24px 24px -12px rgba(0,0,0,.02)";
export const display = "text-[40px] sm:text-[56px] font-bold leading-none tracking-[-0.025em] [text-wrap:balance]";
export const heading = "text-[28px] sm:text-[32px] font-bold leading-[1.1] tracking-[-0.025em] [text-wrap:balance]";
export const pill = "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold";
const LABELS: Record<SiteLang, string> = { en: "English", pt: "Português", es: "Español" };

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
/** A site link in a language: English is the plain path, the others add ?lang=. */
export const hrefFor = (path: string, lang: string) => (lang === "en" ? path : `${path}?lang=${lang}`);

/** The app's screen in the page's language (public/landing/pt, /es); English is the default set. */
export const localShot = (src: string, lang: string) => (lang === "pt" || lang === "es" ? src.replace("/landing/", `/landing/${lang}/`) : src);

/** The page's language: ?lang=, else the visitor's saved or phone language (en, pt or es). */
export async function pageLang(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  return siteLang(await getLang((await searchParams).lang));
}

/** Title, description, canonical, every language version and Open Graph for a site page. */
export function siteMetadata(path: string, lang: SiteLang, meta: { title: string; description: string }): Metadata {
  // The share picture with this page's own title (src/app/og).
  const image = { url: `/og?p=${encodeURIComponent(path)}&lang=${lang}`, width: 1200, height: 630, alt: meta.title };
  const url = `${appUrl()}${hrefFor(path, lang)}`;
  const title = `${meta.title} · ${APP_NAME}`;
  return {
    title: { absolute: title },
    description: meta.description,
    alternates: {
      canonical: url,
      languages: { ...Object.fromEntries(SITE_LANGS.map((l) => [l, `${appUrl()}${hrefFor(path, l)}`])), "x-default": `${appUrl()}${path}` },
    },
    openGraph: { title, description: meta.description, url, type: "website", siteName: APP_NAME, images: [image], locale: lang },
    twitter: { card: "summary_large_image", title, description: meta.description, images: [image] },
  };
}

/** JSON-LD: the page's breadcrumb, plus its questions when it has some. */
export function JsonLd({ path, lang, name, home, faq }: { path: string; lang: SiteLang; name: string; home: string; faq?: { q: string; a: string }[] }) {
  const data: object[] = [{
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: home, item: `${appUrl()}${hrefFor("/", lang)}` },
      { "@type": "ListItem", position: 2, name, item: `${appUrl()}${hrefFor(path, lang)}` },
    ],
  }];
  if (faq?.length) {
    data.push({
      "@context": "https://schema.org", "@type": "FAQPage", inLanguage: lang,
      mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function Phone({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="relative mx-auto w-[240px] sm:w-[280px] rounded-[46px] bg-[#111] p-[10px]" style={{ boxShadow: "0 40px 80px -20px rgba(13,0,33,.45)" }}>
      <div className="overflow-hidden rounded-[36px] bg-white">
        <Image src={src} alt={alt} width={780} height={1688} priority={priority} sizes="280px" className="block h-auto w-full" />
      </div>
    </div>
  );
}

/** The floating pill nav, on every page of the site. `anchors` are the home page's own sections. */
export function SiteNav({ c, lang, anchors, signupHref }: { c: SiteChrome; lang: string; anchors?: { href: string; label: string }[]; signupHref?: string }) {
  const links = anchors ?? [
    { href: hrefFor("/features", lang), label: c.nav.features },
    { href: hrefFor("/pricing", lang), label: c.nav.pricing },
  ];
  return (
    <header className="sticky top-3 z-30 px-4 pt-3">
      <nav aria-label="Main" className="mx-auto flex max-w-[860px] items-center gap-2 rounded-full border border-[#cfcfcf]/60 bg-white/90 py-2 pl-4 pr-2 backdrop-blur"
        style={{ boxShadow: "0 1px 1px .5px rgba(0,0,0,.03), 0 3px 3px 1.5px rgba(0,0,0,.03), 0 6px 6px -3px rgba(0,0,0,.03), 0 12px 12px -6px rgba(0,0,0,.03)" }}>
        <Link href={hrefFor("/", lang)} className="flex items-center gap-2 text-[15px] font-bold">
          <Image src="/icon.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
          {APP_NAME}
        </Link>
        <span className="ml-auto hidden items-center gap-1 text-[15px] font-medium sm:flex">
          {links.map((l) => <a key={l.href} href={l.href} className="rounded-full px-3 py-1.5 hover:bg-[#faf8f7]">{l.label}</a>)}
          <Link href={hrefFor("/login", lang)} className="rounded-full px-3 py-1.5 hover:bg-[#faf8f7]">{c.nav.login}</Link>
        </span>
        <Link href={signupHref ?? hrefFor("/signup", lang)} className="ml-auto rounded-full border border-black/50 px-4 py-2 text-[15px] font-semibold sm:ml-1">{c.nav.start}</Link>
        {/* Phones: the same links behind a menu button (opens without any script). */}
        <details className="group relative sm:hidden">
          <summary aria-label={c.nav.menu} className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full hover:bg-[#faf8f7]">
            <span aria-hidden className="text-[20px] leading-none group-open:hidden">☰</span>
            <span aria-hidden className="hidden text-[20px] leading-none group-open:inline">✕</span>
          </summary>
          <div className="absolute right-0 top-12 w-56 rounded-2xl bg-white p-2 text-[16px] font-medium" style={{ boxShadow: SHADOW }}>
            {[...links, { href: hrefFor("/login", lang), label: c.nav.login }].map((l) => (
              <a key={l.href} href={l.href} className="block rounded-xl px-4 py-3 hover:bg-[#faf8f7]">{l.label}</a>
            ))}
          </div>
        </details>
      </nav>
    </header>
  );
}

/** The footer: every page of the site (so each one is a click away) and the three languages. */
export function SiteFooter({ c, lang, path }: { c: SiteChrome; lang: string; path: string }) {
  const f = c.footer;
  const product = [
    ["/features", f.features], ["/pricing", f.pricing], ["/mobile-grooming-software", f.mobile],
    ["/mobile-grooming-route-planner", f.route], ["/switch", f.switch], ["/guides", f.guides],
  ];
  return (
    <footer className="px-4 pb-10 pt-14 text-[13px] text-white/60" style={{ background: INK }}>
      <div className="mx-auto grid max-w-[1100px] gap-8 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="text-[15px] font-semibold text-white">{APP_NAME}</p>
          <p className="mt-2 max-w-[280px] leading-relaxed">{c.closer.sub}</p>
        </div>
        <nav aria-label={f.product}>
          <p className="font-semibold text-white">{f.product}</p>
          <ul className="mt-3 space-y-2">
            {product.map(([href, label]) => <li key={href}><Link href={hrefFor(href, lang)} className="hover:text-white">{label}</Link></li>)}
          </ul>
        </nav>
        <nav aria-label={f.company}>
          <p className="font-semibold text-white">{f.company}</p>
          <ul className="mt-3 space-y-2">
            <li><Link href="/terms" className="hover:text-white">{f.terms}</Link></li>
            <li><Link href="/privacy" className="hover:text-white">{f.privacy}</Link></li>
            <li><Link href={hrefFor("/login", lang)} className="hover:text-white">{f.login}</Link></li>
          </ul>
        </nav>
      </div>
      <div className="mx-auto mt-10 flex max-w-[1100px] flex-wrap items-center gap-3 border-t border-white/[0.08] pt-6">
        <span>© {new Date().getFullYear()} {APP_NAME}. {f.rights}</span>
        <span className="ml-auto flex gap-2" aria-label="Language">
          {SITE_LANGS.map((l) => (
            <a key={l} href={l === "en" ? `${path}?lang=en` : `${path}?lang=${l}`} hrefLang={l} aria-current={l === lang ? "true" : undefined}
              className={`rounded-full px-2.5 py-1 ${l === lang ? "bg-white/10 text-white" : "hover:text-white"}`}>{LABELS[l]}</a>
          ))}
        </span>
      </div>
    </footer>
  );
}

/** The last call on every page, on the dark background. */
export function Closer({ c, lang, note }: { c: SiteChrome; lang: string; note?: string }) {
  return (
    <section className="px-4 py-20 text-center text-white sm:py-28" style={{ background: INDIGO }}>
      <h2 className={`mx-auto max-w-[760px] ${display}`}>{c.closer.title}</h2>
      <p className="mx-auto mt-5 max-w-[520px] text-[17px] leading-[1.5] text-[#cfcfcf]">{c.closer.sub}</p>
      <div className="mt-8"><Link href={hrefFor("/signup", lang)} className={`${pill} text-black`} style={{ background: AMBER }}>{c.closer.cta} →</Link></div>
      {note && <p className="mt-3 text-[13px] text-white/60">{note}</p>}
    </section>
  );
}

/** Questions and answers that open in place (no script needed). */
export function Questions({ title, items, dark = false }: { title: string; items: { q: string; a: string }[]; dark?: boolean }) {
  return (
    <div className="mx-auto max-w-[760px]">
      <h2 className={heading}>{title}</h2>
      <div className={`mt-8 divide-y border-y ${dark ? "divide-white/[0.08] border-white/[0.08]" : "divide-black/[0.08] border-black/[0.08]"}`}>
        {items.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold">
              {item.q}<span aria-hidden className={`transition group-open:rotate-45 ${dark ? "text-[#89898e]" : "text-[#737373]"}`}>+</span>
            </summary>
            <p className={`mt-3 text-[15px] leading-[1.6] ${dark ? "text-[#cfcfcf]" : "text-[#333]"}`}>{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

/** Wraps a site page: font, nav, the page, the closing call and the footer. */
export function SitePage({ lang, path, children, closerNote }: { lang: SiteLang; path: string; children: ReactNode; closerNote?: string }) {
  const c = siteChrome(lang);
  return (
    <div lang={lang} className="min-h-full bg-white text-black antialiased" style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <SiteNav c={c} lang={lang} />
      <main>
        {children}
        <Closer c={c} lang={lang} note={closerNote} />
      </main>
      <SiteFooter c={c} lang={lang} path={path} />
    </div>
  );
}

/** The white hero at the top of a site page. */
export function Hero({ kicker, title, sub, lang, c, note, aside }: {
  kicker: string; title: string; sub: string; lang: string; c: SiteChrome; note?: string; aside?: ReactNode;
}) {
  return (
    <section className="px-4 pb-16 pt-14 sm:pt-20">
      <div className={`mx-auto grid max-w-[1100px] items-center gap-12 ${aside ? "md:grid-cols-[1.15fr_1fr]" : ""}`}>
        <div className={aside ? "text-center md:text-left" : "text-center"}>
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: BLUE }}>{kicker}</p>
          <h1 className={`mt-3 ${aside ? "" : "mx-auto max-w-[820px]"} ${display}`}>{title}</h1>
          <p className={`mt-5 max-w-[620px] text-[17px] leading-[1.5] tracking-[-0.01em] text-[#333] [text-wrap:pretty] ${aside ? "mx-auto md:mx-0" : "mx-auto"}`}>{sub}</p>
          <div className={`mt-8 flex flex-wrap items-center gap-3 ${aside ? "justify-center md:justify-start" : "justify-center"}`}>
            <Link href={hrefFor("/signup", lang)} className={`${pill} text-white`} style={{ background: BLUE }}>{c.closer.cta}</Link>
          </div>
          {note && <p className="mt-3 text-[13px] text-[#737373]">{note}</p>}
        </div>
        {aside}
      </div>
    </section>
  );
}
