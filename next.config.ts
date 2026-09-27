import type { NextConfig } from "next";

/**
 * As fotos dos imóveis são servidas pelo Supabase Storage. O host varia por
 * projeto, então é derivado da própria variável de ambiente — assim ninguém
 * precisa lembrar de editar dois lugares ao trocar de projeto.
 */
const supabaseOrigin = (() => {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    // O protocolo também vem da variável: https no Supabase de produção,
    // http no Supabase local da CLI (http://127.0.0.1:54321).
    return { hostname: url.hostname, protocol: url.protocol === "http:" ? ("http" as const) : ("https" as const) };
  } catch {
    return null;
  }
})();

const isDev = process.env.NODE_ENV !== "production";
const supabaseHttp = supabaseOrigin ? `${supabaseOrigin.protocol}://${supabaseOrigin.hostname}` : "";
const supabaseWs = supabaseOrigin ? `${supabaseOrigin.protocol === "http" ? "ws" : "wss"}://${supabaseOrigin.hostname}` : "";
const googleAnalytics = "https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com";

/**
 * Content-Security-Policy sem nonce: nonce obrigaria toda página a ser
 * dinâmica e acabaria com a ISR do site. 'unsafe-inline' em script continua
 * necessário para os scripts inline do Next; o ganho aqui é fechar o resto —
 * de onde vêm scripts, para onde o navegador pode enviar dados, quem pode
 * pôr o site num iframe, <object>, <base> e o destino dos formulários.
 * Porta de entrada de terceiros: Supabase (fotos, upload do painel), Google
 * Analytics (só se configurado) e o mapa do OpenStreetMap.
 */
const directive = (...parts: string[]) => parts.filter(Boolean).join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  directive("img-src 'self' data: blob:", supabaseHttp, googleAnalytics),
  "font-src 'self' data:",
  "media-src 'self'",
  directive("connect-src 'self'", supabaseHttp, supabaseWs, googleAnalytics),
  "frame-src https://www.openstreetmap.org",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Sem includeSubDomains: outros subdomínios do valedosolimoveis.com.br
  // (e-mail, hospedagem antiga) podem não ter HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  experimental: {
    serverActions: {
      // "Venda seu imóvel" envia fotos pela server action (padrão: 1 MB). O
      // formulário reduz as fotos no navegador antes; 4 MB fica abaixo do
      // limite de corpo das funções da Vercel (4,5 MB).
      bodySizeLimit: "4mb",
    },
  },

  images: {
    remotePatterns: supabaseOrigin
      ? [
          {
            protocol: supabaseOrigin.protocol,
            hostname: supabaseOrigin.hostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
    // Tamanhos alinhados aos breakpoints reais do layout, para não gerar
    // variantes que o site nunca pede.
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [96, 160, 240, 320, 480],
    formats: ["image/avif", "image/webp"],
    qualities: [70, 80, 85, 90],
  },

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Painel (admin.valedosolimoveis.com.br): nada ali entra em índice de
        // busca, nem as respostas que não são HTML. Mesma regra de host de
        // lib/admin-host.ts; o site público não recebe este cabeçalho.
        source: "/:path*",
        has: [{ type: "host", value: "admin\\..+" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },

  async redirects() {
    return [
      // URLs do site antigo em WordPress. As páginas de imóvel mantêm o
      // mesmo caminho (/imoveis/<slug>), então não precisam de redirect.
      { source: "/sobre", destination: "/a-imobiliaria", permanent: true },
      { source: "/envie-seu-imovel", destination: "/venda-seu-imovel", permanent: true },
      { source: "/local/:city", destination: "/regioes/:city", permanent: true },
      { source: "/local/:city/:hood", destination: "/regioes/:hood", permanent: true },
      { source: "/tipo-de-imovel/:slug", destination: "/imoveis?tipo=:slug", permanent: true },
      { source: "/situacao/:slug", destination: "/imoveis?status=:slug", permanent: true },
      { source: "/corretores", destination: "/a-imobiliaria", permanent: true },
    ];
  },
};

export default nextConfig;
