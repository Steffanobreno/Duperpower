import Link from "next/link";
import { getLang } from "@/lib/i18n/server";
import { siteChrome, siteLang } from "./site-copy";
import { SiteFooter, SiteNav, display, hrefFor } from "./site-chrome";

// A missing page: said plainly, in the visitor's language, with the pages most people want next.
export default async function NotFound() {
  const lang = siteLang(await getLang());
  const c = siteChrome(lang);
  const links = [
    ["/", c.home], ["/features", c.footer.features], ["/pricing", c.footer.pricing], ["/guides", c.footer.guides], ["/login", c.nav.login],
  ];
  return (
    <div lang={lang} className="min-h-full bg-white text-black antialiased" style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <SiteNav c={c} lang={lang} />
      <main className="px-4 py-24 text-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#737373]">404</p>
        <h1 className={`mx-auto mt-3 max-w-[720px] ${display}`}>{c.notFound.title}</h1>
        <p className="mx-auto mt-5 max-w-[520px] text-[17px] leading-[1.5] text-[#333]">{c.notFound.text}</p>
        <nav aria-label={c.related} className="mx-auto mt-8 flex max-w-[620px] flex-wrap justify-center gap-2">
          {links.map(([href, label]) => (
            <Link key={href} href={hrefFor(href, lang)} className="rounded-full border border-black/15 px-4 py-2 text-[15px] font-semibold hover:border-black/40">{label}</Link>
          ))}
        </nav>
      </main>
      <SiteFooter c={c} lang={lang} path="/" />
    </div>
  );
}
