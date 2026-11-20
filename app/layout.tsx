import type { Metadata, Viewport } from "next";
import { Poppins, Roboto } from "next/font/google";
import { SITE } from "@/lib/site";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";
import "./globals.css";

// Mesmo par do site da Issa Materiais: Roboto no texto, Poppins nos títulos.
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Imóveis em Arujá desde 1975`,
    template: `%s | ${SITE.name}`,
  },
  description:
    "Casas, terrenos, condomínios, chácaras e imóveis comerciais em Arujá e região, selecionados por quem conhece a cidade desde 1975.",
  openGraph: {
    type: "website",
    title: `${SITE.name} — Imóveis em Arujá desde 1975`,
    description:
      "Imóveis selecionados em Arujá e região por uma imobiliária que faz parte da história da cidade desde 1975.",
    locale: "pt_BR",
    siteName: SITE.name,
    url: SITE.url,
    images: [DEFAULT_OG_IMAGE],
  },
  // Imagem padrão de compartilhamento: páginas com foto própria (imóveis)
  // sobrescrevem. Sem isto, link no WhatsApp e resposta de IA saem sem imagem.
  twitter: { card: "summary_large_image", images: [DEFAULT_OG_IMAGE.url] },
  robots: SITE.noindex
    ? { index: false, follow: false }
    : { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0b4423",
  width: "device-width",
  initialScale: 1,
  // Libera env(safe-area-inset-*) para a barra fixa do imóvel no iPhone.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${roboto.variable} ${poppins.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
