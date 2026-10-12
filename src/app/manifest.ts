import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FIA",
    short_name: "FIA",
    description: "Contale a Fia qué gastaste y ella lo anota.",
    lang: "es-AR",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eceff5",
    theme_color: "#eceff5",
    icons: [
      { src: "/iconos/fia-192.png", sizes: "192x192", type: "image/png" },
      { src: "/iconos/fia-512.png", sizes: "512x512", type: "image/png" },
      { src: "/iconos/fia-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
