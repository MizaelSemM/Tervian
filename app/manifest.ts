import type { MetadataRoute } from "next";

/**
 * Manifest do PWA (tarefa 012). Servido em `/manifest.webmanifest` pelo
 * App Router; ícones em `public/icons/` (gerados a partir da marca).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tervian — CRM de follow-up",
    short_name: "Tervian",
    description: "Saiba quem chamar e por quê. Follow-up simples para equipes de vendas.",
    start_url: "/hoje",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f5f0",
    theme_color: "#f4f5f0",
    lang: "pt-BR",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
