import type { MetadataRoute } from "next";

/** Manifest de la app instalable: abre directo en la caja. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Inversiones Ferrera — Caja",
    short_name: "Ferrera Caja",
    description: "Punto de venta de Inversiones Ferrera.",
    start_url: "/caja",
    scope: "/",
    display: "standalone",
    background_color: "#f7f6f3",
    theme_color: "#216b38",
    lang: "es-HN",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
