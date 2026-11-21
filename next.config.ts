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

const nextConfig: NextConfig = {
  images: {
    // Fotos redimensionadas pelo Supabase, não pela Vercel (ver lib/image-loader.ts).
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
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
      {
        // Painel (admin.valedosolimoveis.com.br): nada ali entra em índice de
        // busca, nem as respostas que não são HTML. Mesma regra de host de
        // lib/admin-host.ts; o site público não recebe este cabeçalho.
        source: "/:path*",
        has: [{ type: "host", value: "admin\\..+" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      // Busca e links curtos do WordPress (?s=, ?p=, ?page_id=) caíam na home
      // com 200: era por aí que o spam do site antigo entrava no índice.
      ...["s", "p", "page_id"].map((key) => ({
        source: "/",
        has: [{ type: "query" as const, key }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
      })),
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
      // Categorias do WordPress → páginas indexáveis (as listagens com filtro são noindex).
      { source: "/tipo-de-imovel/:slug(casa.*|sobrado.*|residencia.*)", destination: "/casas-a-venda-em-aruja", permanent: true },
      { source: "/tipo-de-imovel/:slug(terreno.*|lote.*|area.*)", destination: "/terrenos-a-venda-em-aruja", permanent: true },
      { source: "/tipo-de-imovel/:slug(chacara.*|sitio.*)", destination: "/chacaras-a-venda-em-aruja", permanent: true },
      { source: "/tipo-de-imovel/:slug(comercial.*|sala.*|galpao.*|predio.*|loja.*)", destination: "/imoveis-comerciais-em-aruja", permanent: true },
      { source: "/tipo-de-imovel/:slug", destination: "/imoveis", permanent: true },
      { source: "/situacao/:slug(alug.*|loca.*)", destination: "/imoveis-para-alugar-em-aruja", permanent: true },
      { source: "/situacao/:slug", destination: "/imoveis", permanent: true },
      // Página de simulação do WordPress: o simulador agora fica em cada imóvel.
      { source: "/simulacao", destination: "/imoveis", permanent: true },
      { source: "/corretores", destination: "/a-imobiliaria", permanent: true },

      // O e-mail continua na Hostinger (cPanel); o domínio raiz está na Vercel.
      // Os atalhos que existiam no servidor antigo passam a apontar para lá.
      // Temporários (307) para não ficarem presos no cache do navegador.
      { source: "/webmail", destination: "https://webmail.valedosolimoveis.com.br", permanent: false },
      { source: "/cpanel", destination: "https://cpanel.valedosolimoveis.com.br", permanent: false },
    ];
  },
};

export default nextConfig;
