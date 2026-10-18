import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is dynamic everywhere (every screen reads the login), so we use the
  // classic rendering model instead of Cache Components.
  cacheComponents: false,
  serverExternalPackages: ["postgres"],
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
