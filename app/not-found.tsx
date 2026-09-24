import Link from "next/link";

/**
 * 404 de raiz — atende as URLs fora do grupo (site), que não passam pelo
 * layout público. Por isso ele não depende de header nem de footer.
 */
export default function RootNotFound() {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center font-sans">
        <p className="font-display text-6xl text-[#b8892b]">404</p>
        <h1 className="mt-6 font-display text-3xl text-[#141a16]">Página não encontrada</h1>
        <p className="mt-3 max-w-sm text-[#4b534d]">
          O endereço que você abriu não existe no site da Vale do Sol Imóveis.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center rounded-[4px] bg-[#0b4423] px-6 text-sm font-medium text-white"
        >
          Ir para a página inicial
        </Link>
      </body>
    </html>
  );
}
