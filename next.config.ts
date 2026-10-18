import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is dynamic everywhere (every screen reads the login), so we use the
  // classic rendering model instead of Cache Components.
  cacheComponents: false,
  serverExternalPackages: ["postgres"],
  // The booking page may be shown inside the business website (iframe); nothing else may.
  async headers() {
    const site = "https://woofersdogspa.com https://*.woofersdogspa.com https://*.lovable.app https://*.lovableproject.com";
    return [
      { source: "/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }] },
      { source: "/book", headers: [{ key: "Content-Security-Policy", value: `frame-ancestors 'self' ${site}` }] },
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
