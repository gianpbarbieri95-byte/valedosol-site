import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { SITE } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Serifa editorial dos títulos. Cormorant Garamond (e não "Cormorant") por
// ter algarismos alinhados: preços e anos não dançam na linha.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
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
  },
  twitter: { card: "summary_large_image" },
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
    <html lang="pt-BR" className={`${inter.variable} ${cormorant.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
