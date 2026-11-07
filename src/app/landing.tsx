import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { PLAN_PRICES, type LandingCopy } from "./landing-copy";
import { SiteFooter, SiteNav, hrefFor, localShot } from "./site-chrome";
import { siteChrome, siteLang } from "./site-copy";

// The sales page. Visual language: a white "departure board" upper page that drops into a deep
// midnight-indigo "control room"; one blue for the main action, amber only for the final
// conversion on dark; a floating pill nav; the real app on a phone, with live-looking
// notification cards scattered around it. System font throughout, tight display type.

const INDIGO = "#0d0021";
const INK = "#05010d";
const BLUE = "#0066d6"; // 5.4:1 with white text (WCAG AA)
const AMBER = "#f7be00";
const RED = "#d92d20";
const SHADOW =
  "0 0 0 1px rgba(0,0,0,.04), 0 1px 1px .5px rgba(0,0,0,.02), 0 3px 3px 1.5px rgba(0,0,0,.02), 0 6px 6px -3px rgba(0,0,0,.02), 0 12px 12px -6px rgba(0,0,0,.02), 0 24px 24px -12px rgba(0,0,0,.02)";
const display = "text-[40px] sm:text-[56px] font-bold leading-none tracking-[-0.025em] [text-wrap:balance]";
const heading = "text-[28px] sm:text-[32px] font-bold leading-[1.1] tracking-[-0.025em] [text-wrap:balance]";
const pill = "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold";

function Phone({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="relative mx-auto w-[260px] sm:w-[300px] rounded-[48px] bg-[#111] p-[10px]" style={{ boxShadow: "0 40px 80px -20px rgba(13,0,33,.45)" }}>
      <div className="overflow-hidden rounded-[38px] bg-white">
        <Image src={src} alt={alt} width={780} height={1688} priority={priority} sizes="300px" className="block h-auto w-full" />
      </div>
    </div>
  );
}

/** A live-looking notification: icon, bold line, muted detail, optional status edge. */
function FloatCard({ icon, title, meta, edge, className = "", rotate = 0 }: {
  icon: ReactNode; title: string; meta: string; edge?: string; className?: string; rotate?: number;
}) {
  return (
    <div className={`w-[250px] rounded-[20px] bg-white p-4 text-left ${className}`}
      style={{ boxShadow: SHADOW, transform: `rotate(${rotate}deg)`, borderLeft: edge ? `3px solid ${edge}` : undefined }}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#faf8f7] text-base">{icon}</span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold leading-tight text-black">{title}</span>
          <span className="mt-1 block text-[13px] leading-snug text-[#737373]">{meta}</span>
        </span>
      </div>
    </div>
  );
}

const ICONS = ["✓", "🗓", "🚐", "🧭", "💉"];
const EDGES = [BLUE, undefined, undefined, undefined, RED];

export function Landing({ c, lang }: { c: LandingCopy; lang: string }) {
  const signup = `/signup${lang === "en" ? "" : `?lang=${lang}`}`;
  const chrome = siteChrome(siteLang(lang));
  const priced = PLAN_PRICES.monthly != null && PLAN_PRICES.yearly != null;
  return (
    <div lang={lang} className="min-h-full bg-white text-black antialiased" style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Announcement bar */}
      <aside aria-label={c.bar.text} className="px-4 py-2 text-center text-[13px] font-medium text-white" style={{ background: INDIGO }}>
        🌍 {c.bar.text} · <Link href={hrefFor("/features", lang)} className="underline underline-offset-2">{c.bar.link} →</Link>
      </aside>

      <SiteNav c={chrome} lang={lang} anchors={[
        { href: hrefFor("/features", lang), label: c.nav.features },
        { href: "#pricing", label: c.nav.pricing },
        { href: "#faq", label: c.nav.faq },
      ]} />

      <main>
      {/* Hero: the departure board */}
      <section className="px-4 pb-16 pt-14 text-center sm:pt-20">
        <h1 className={`mx-auto max-w-[820px] ${display}`}>{c.hero.title}</h1>
        <p className="mx-auto mt-5 max-w-[620px] text-[17px] leading-[1.5] tracking-[-0.01em] text-[#333] [text-wrap:pretty]">{c.hero.sub}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href={signup} className={`${pill} text-white`} style={{ background: BLUE }}>{c.hero.cta}</Link>
          <a href="#features" className={`${pill} text-black`}>{c.hero.secondary} ↓</a>
        </div>
        <p className="mt-3 text-[13px] text-[#737373]">{c.hero.note}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full border border-[#cfcfcf] bg-white px-4 py-2 text-[13px] font-semibold">🐾 {c.hero.badgeA}</span>
          <span className="rounded-full px-4 py-2 text-[13px] font-semibold text-white" style={{ background: BLUE }}>🌍 {c.hero.badgeB}</span>
        </div>

        {/* The phone with the day, and the cards that orbit it */}
        <div className="relative mx-auto mt-14 max-w-[1100px]">
          <div className="relative z-10"><Phone src={localShot("/landing/today.png", lang)} alt={c.hero.shotAlt} priority /></div>
          <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
            <FloatCard icon={ICONS[0]} edge={EDGES[0]} {...c.cards[0]} rotate={-3} className="absolute left-[calc(50%-470px)] top-[6%]" />
            <FloatCard icon={ICONS[1]} {...c.cards[1]} rotate={2} className="absolute left-[calc(50%-420px)] top-[40%]" />
            <FloatCard icon={ICONS[4]} edge={EDGES[4]} {...c.cards[4]} rotate={-2} className="absolute left-[calc(50%-480px)] top-[72%]" />
            <FloatCard icon={ICONS[2]} {...c.cards[2]} rotate={3} className="absolute right-[calc(50%-460px)] top-[12%]" />
            <FloatCard icon={ICONS[3]} {...c.cards[3]} rotate={-2} className="absolute right-[calc(50%-420px)] top-[52%]" />
          </div>
          {/* Phones and tablets: the same cards in a tidy stack under the phone */}
          <ul className="mx-auto mt-8 grid max-w-[540px] gap-3 text-left sm:grid-cols-2 lg:hidden">
            {c.cards.map((card, i) => (
              <li key={card.title}><FloatCard icon={ICONS[i]} edge={EDGES[i]} {...card} className="w-full" /></li>
            ))}
          </ul>
        </div>
      </section>

      {/* The control room */}
      <section id="features" className="scroll-mt-20 px-4 py-20 text-white sm:py-28" style={{ background: INDIGO }}>
        <div className="mx-auto max-w-[1100px]">
          <h2 className={`mx-auto max-w-[760px] text-center ${display}`}>{c.dark.title}</h2>
          <p className="mx-auto mt-5 max-w-[560px] text-center text-[17px] leading-[1.5] text-[#cfcfcf]">{c.dark.sub}</p>

          <div className="mt-16 space-y-20 sm:mt-24 sm:space-y-28">
            {c.rows.map((row, i) => (
              <div key={row.title} className={`grid items-center gap-10 md:grid-cols-2 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
                <div className="relative">
                  <div aria-hidden className="absolute inset-x-8 inset-y-12 rounded-full blur-3xl"
                    style={{ background: "linear-gradient(180deg, rgb(18,0,54) 0%, rgb(37,1,96) 51%, rgb(18,0,54) 100%)" }} />
                  <div className="relative"><Phone src={localShot(row.shot, lang)} alt={row.alt} /></div>
                </div>
                <div className="max-w-[460px]">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#89898e]">{row.kicker}</p>
                  <h3 className={`mt-3 ${heading}`}>{row.title}</h3>
                  <p className="mt-4 text-[17px] leading-[1.5] text-[#cfcfcf]">{row.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* What's included, as flat tiles */}
          <ul className="mt-24 grid grid-cols-2 gap-3 md:grid-cols-4">
            {c.tiles.map((tile) => (
              <li key={tile.title} className="rounded-2xl border border-white/[0.08] px-5 py-8 sm:py-10" style={{ background: INK }}>
                <p className="text-[17px] font-semibold text-white">{tile.title}</p>
                <p className="mt-1.5 text-[13px] leading-snug text-white/60">{tile.text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-center">
            <Link href={hrefFor("/features", lang)} className={`${pill} border border-white/25 text-white`} style={{ background: INK }}>{c.bar.link} →</Link>
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 px-4 py-20 text-white sm:py-24" style={{ background: INDIGO }}>
        <div className="mx-auto max-w-[860px] text-center">
          <h2 className={heading}>{c.pricing.title}</h2>
          <p className="mx-auto mt-4 max-w-[520px] text-[17px] leading-[1.5] text-[#cfcfcf]">{c.pricing.sub}</p>
          {priced ? (
            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {[[c.pricing.monthly, `$${PLAN_PRICES.monthly}`, c.pricing.perMonth], [c.pricing.yearly, `$${PLAN_PRICES.yearly}`, c.pricing.perYear]].map(([name, price, per]) => (
                <div key={name} className="rounded-2xl border border-white/[0.08] p-8 text-left" style={{ background: INK }}>
                  <p className="text-[15px] font-semibold text-[#cfcfcf]">{name}</p>
                  <p className="mt-2 text-[40px] font-bold tracking-[-0.025em]">{price}<span className="text-[17px] font-medium text-[#89898e]">{per}</span></p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mx-auto mt-8 max-w-[520px] rounded-2xl border border-white/[0.08] px-6 py-5 text-[15px] text-[#cfcfcf]" style={{ background: INK }}>{c.pricing.soon}</p>
          )}
          <ul className="mx-auto mt-8 grid max-w-[620px] gap-2 text-left text-[15px] text-[#cfcfcf] sm:grid-cols-2">
            {c.pricing.included.map((x) => <li key={x}>✓ {x}</li>)}
          </ul>
        </div>
      </section>

      {/* Questions, then the last call */}
      <section id="faq" className="scroll-mt-20 px-4 py-20 text-white sm:py-24" style={{ background: INDIGO }}>
        <div className="mx-auto max-w-[760px]">
          <h2 className={heading}>{c.faq.title}</h2>
          <div className="mt-8 divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {c.faq.items.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold">
                  {item.q}<span aria-hidden className="text-[#89898e] transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-[15px] leading-[1.6] text-[#cfcfcf]">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
        <div className="mx-auto mt-24 max-w-[760px] text-center">
          <h2 className={display}>{c.closer.title}</h2>
          <p className="mx-auto mt-5 max-w-[520px] text-[17px] leading-[1.5] text-[#cfcfcf]">{c.closer.sub}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href={signup} className={`${pill} text-black`} style={{ background: AMBER }}>{c.closer.cta} →</Link>
            <Link href="/login" className={`${pill} border border-white/25 text-white`} style={{ background: INK }}>{c.closer.login}</Link>
          </div>
        </div>
      </section>

      </main>
      <SiteFooter c={chrome} lang={lang} path="/" />
    </div>
  );
}
