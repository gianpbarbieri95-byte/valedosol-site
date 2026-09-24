import Script from "next/script";
import { getSettings } from "@/lib/queries/settings";

/**
 * Google Analytics.
 *
 * Só é carregado quando a imobiliária cadastrar o ID em Configurações. Sem ID,
 * nenhum script de terceiro entra na página — nada de peso e de rastreamento
 * que ninguém pediu.
 */
export async function Analytics() {
  const { analytics } = await getSettings();
  const id = analytics.ga_measurement_id?.trim();

  if (!id) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}');
        `}
      </Script>
    </>
  );
}

/** Verificação de propriedade no Search Console, quando houver. */
export async function SearchConsoleVerification() {
  const { analytics } = await getSettings();
  const token = analytics.gsc_verification?.trim();

  if (!token) return null;
  return <meta name="google-site-verification" content={token} />;
}
