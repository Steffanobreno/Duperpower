import type { NextConfig } from "next";

// What a page may load (Content-Security-Policy): scripts, styles and fonts from this site and
// Google Maps only; no plugins; forms post only here; links can't change the page's base.
// 'unsafe-inline' scripts: Next.js puts its page data in inline scripts (a nonce would make every
// page uncacheable). Pictures may come from any https address (map tiles, email previews).
function contentSecurityPolicy(ancestors: string) {
  const maps = "https://maps.googleapis.com https://maps.gstatic.com";
  // Tests point Google Maps at a fake server.
  const fake = process.env.NEXT_PUBLIC_GOOGLE_MAPS_SCRIPT_URL ? new URL(process.env.NEXT_PUBLIC_GOOGLE_MAPS_SCRIPT_URL).origin : "";
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${maps} ${fake}${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:" + (fake ? ` ${fake}` : ""),
    `connect-src 'self' https://*.googleapis.com https://*.gstatic.com ${fake}${dev ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${ancestors}`,
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

const nextConfig: NextConfig = {
  // The app is dynamic everywhere (every screen reads the login), so we use the
  // classic rendering model instead of Cache Components.
  cacheComponents: false,
  // Don't announce the framework in every answer.
  poweredByHeader: false,
  serverExternalPackages: ["postgres"],
  // Booking requests can carry up to 4 pet photos (already shrunk), and client CSV imports.
  // staleTimes: going back to a screen seen in the last 30 seconds is instant (saving
  // anything refreshes it anyway).
  experimental: { serverActions: { bodySizeLimit: "4mb" }, staleTimes: { dynamic: 30 } },
  // The booking page may be shown inside the business website (iframe); nothing else may.
  async headers() {
    // lovable.dev too: its editor shows the site preview inside itself, and every frame up the chain must be allowed.
    const site = "https://woofersdogspa.com https://*.woofersdogspa.com https://*.lovable.app https://*.lovableproject.com https://lovable.dev https://*.lovable.dev";
    // Basic hardening for every page: no MIME sniffing, private links (/a/<token>, /r/<token>)
    // never leak in the Referer, HTTPS only once seen (browsers ignore this over plain http),
    // this site's windows kept apart from pages it opens (Stripe, Google) and from pages that open it.
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=31536000" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(self), usb=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
    ];
    const csp = (ancestors: string) => contentSecurityPolicy(ancestors);
    return [
      { source: "/:path*", headers: [...security, { key: "Content-Security-Policy", value: csp("'self'") }] },
      { source: "/book", headers: [{ key: "Content-Security-Policy", value: csp(`'self' ${site}`) }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
