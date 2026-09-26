import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Renova a sessão do Supabase nas rotas do painel e barra /admin no servidor.
 *
 * A partir do Next.js 16 este arquivo se chama proxy.ts (era middleware.ts).
 *
 * Isto é a primeira linha de defesa, não a única: cada página administrativa
 * confere a sessão novamente, e a RLS confere no banco. Middleware sozinho
 * nunca é garantia de autorização.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

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
        response = NextResponse.next({ request });
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

  const { pathname } = request.nextUrl;
  const isAdminArea = pathname.startsWith("/admin");
  // Telas de quem ainda não entrou: login, senha esquecida e o retorno do
  // link enviado por e-mail.
  const isLoginPage = pathname === "/admin/login" || pathname === "/admin/esqueci-senha";
  const isPublicPage = isLoginPage || pathname === "/admin/auth/confirmar";

  if (isAdminArea && !isPublicPage && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginPage && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/admin/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  /*
   * Só o painel. O site público não tem login de visitante (favoritos ficam
   * no navegador), então renovar sessão ali só custava uma ida ao Supabase
   * por página. E, com o proxy em todas as rotas, a home regenerada pela ISR
   * na Vercel recebia outro pathname: o cabeçalho saía do servidor "sólido"
   * e o navegador o montava "transparente" — erro de hidratação #418 (ver
   * "Avoid hydration mismatch with rewrites" na doc do usePathname).
   */
  matcher: ["/admin", "/admin/:path*"],
};
