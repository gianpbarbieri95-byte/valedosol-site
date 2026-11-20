import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * Buscadores com IA (ChatGPT, Claude, Perplexity, Gemini, Copilot) citam o que
 * conseguem ler. Liberar de forma explícita deixa a intenção registrada; o
 * conteúdo é público e é o cartão de visitas da imobiliária.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
];

export default function robots(): MetadataRoute.Robots {
  if (SITE.noindex) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  // A lista pessoal de favoritos não tem por que ser rastreada. O painel não
  // aparece aqui: ele mora em outro host (admin.*), que tem o próprio
  // robots.txt bloqueando tudo, e /admin responde 404 neste.
  const disallow = ["/favoritos", "/api/"];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      { userAgent: AI_CRAWLERS, allow: "/", disallow },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
