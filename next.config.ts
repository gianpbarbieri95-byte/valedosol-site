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
