import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_HOME,
  ADMIN_INTERNAL_PREFIX,
  ADMIN_LOGIN,
  isAdminHost,
} from "@/lib/admin-host";

/**
 * Separa o painel do site público pelo hostname e protege o painel.
 *
 * A partir do Next.js 16 este arquivo se chama proxy.ts (era middleware.ts).
 *
 * - Site público (qualquer host que não seja admin.*): /admin não existe,
 *   responde 404. O proxy só roda ali para dar esse 404 (ver o matcher).
 * - Painel (admin.valedosolimoveis.com.br, admin.localhost no dev): cada
 *   caminho limpo é reescrito para a pasta app/admin — /dashboard vira
 *   /admin/dashboard sem mudar a barra de endereço. Endereços antigos com
 *   /admin/... são redirecionados para a versão limpa.
 *
 * O proxy também renova a sessão do Supabase e barra quem não entrou. Isto é
 * a primeira linha de defesa, não a única: app/admin/layout.tsx recusa
 * qualquer host que não seja o do painel, cada página administrativa confere
 * a sessão novamente, e a RLS confere no banco. Middleware sozinho nunca é
 * garantia de autorização.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isAdminHost(request.headers.get("host"))) {
    return notFound(request);
  }

  // Favoritos, links e e-mails antigos ainda apontam para /admin/...
  if (pathname === ADMIN_INTERNAL_PREFIX || pathname.startsWith(`${ADMIN_INTERNAL_PREFIX}/`)) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.pathname = pathname.slice(ADMIN_INTERNAL_PREFIX.length) || "/";
    return NextResponse.redirect(cleanUrl, 308);
  }

  // O painel inteiro fica fora dos buscadores; o robots.txt público (que
  // aponta para o sitemap do site) não vale para este host.
  if (pathname === "/robots.txt") {
    return new NextResponse("User-agent: *\nDisallow: /\n", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const internalUrl = request.nextUrl.clone();
  internalUrl.pathname = pathname === "/" ? ADMIN_INTERNAL_PREFIX : `${ADMIN_INTERNAL_PREFIX}${pathname}`;
  let response = NextResponse.rewrite(internalUrl, { request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sem configuração de ambiente não há sessão para renovar; deixa passar
  // para que a própria página mostre o aviso de configuração pendente.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.rewrite(internalUrl, { request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalida o token no servidor. getSession() apenas lê o cookie
  // e por isso não serve para decidir acesso.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Telas de quem ainda não entrou: login, senha esquecida e o retorno do
  // link enviado por e-mail.
  const isLoginPage = pathname === ADMIN_LOGIN || pathname === "/esqueci-senha";
  const isPublicPage = isLoginPage || pathname === "/auth/confirmar";

  // A raiz do subdomínio é a porta de entrada: login para quem não entrou,
  // início do painel para quem já entrou.
  if (pathname === "/") {
    return redirectTo(request, response, user ? ADMIN_HOME : ADMIN_LOGIN);
  }

  if (!isPublicPage && !user) {
    return redirectTo(request, response, ADMIN_LOGIN, `?next=${encodeURIComponent(pathname)}`);
  }

  if (isLoginPage && user) {
    return redirectTo(request, response, ADMIN_HOME);
  }

  return response;
}

/**
 * Redirect que leva junto os cookies de sessão renovados pelo Supabase —
 * sem isso, um token atualizado nesta mesma requisição se perderia.
 */
function redirectTo(request: NextRequest, sessionResponse: NextResponse, pathname: string, search = "") {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = search;
  const redirect = NextResponse.redirect(target);
  for (const cookie of sessionResponse.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

/**
 * /admin no site público: a mesma página 404 de qualquer endereço
 * inexistente, sem pistas de que existe um painel.
 */
function notFound(request: NextRequest) {
  return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
}

export const config = {
  matcher: [
    /*
     * Site público: só /admin, para responder 404. O resto do site não passa
     * pelo proxy — não há login de visitante (favoritos ficam no navegador),
     * e, com o proxy em todas as rotas, a home regenerada pela ISR na Vercel
     * recebia outro pathname: o cabeçalho saía do servidor "sólido" e o
     * navegador o montava "transparente" — erro de hidratação #418 (ver
     * "Avoid hydration mismatch with rewrites" na doc do usePathname).
     */
    "/admin",
    "/admin/:path*",
    /*
     * Painel: todos os caminhos do host admin.*, menos os arquivos estáticos
     * (JS/CSS do Next, logo, fontes, vídeo), que são servidos como estão.
     * robots.txt e sitemap.xml passam por aqui: o do site público não vale
     * para o painel. O valor do host é o mesmo de isAdminHost() em
     * lib/admin-host.ts.
     */
    {
      source:
        "/((?!_next/|__nextjs|favicon\\.ico$|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|mp4|webm|woff2?|ttf|otf|css|js|map)$).*)",
      has: [{ type: "host", value: "admin\\..+" }],
    },
  ],
};
