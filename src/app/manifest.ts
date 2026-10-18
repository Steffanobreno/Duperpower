import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Woofers Dog Spa",
    short_name: "Woofers",
    description: "Scheduling, routes and checkout for Woofers Dog Spa.",
    start_url: "/today",
    display: "standalone",
    background_color: "#f4f6f9",
    theme_color: "#1d6fb8",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
