import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdminHost, requestOrigin, safeAdminPath } from "@/lib/admin-host";

/**
 * Destino do link enviado por e-mail (senha esquecida).
 *
 * O Supabase devolve um `code` (fluxo PKCE, o padrão do @supabase/ssr) ou,
 * se o modelo de e-mail tiver sido personalizado, `token_hash` + `type`.
 * Os dois viram sessão aqui, e a pessoa segue para criar a senha nova.
 * Link vencido, já usado ou aberto em outro navegador volta para o login
 * com um aviso claro.
 */
export async function GET(request: NextRequest) {
  // Route Handler não passa pelo app/admin/layout.tsx: a trava de host
  // (que o proxy já aplica) é repetida aqui.
  if (!isAdminHost(request.headers.get("host"))) {
    return new NextResponse(null, { status: 404 });
  }

  const { searchParams } = request.nextUrl;
  // Depois do rewrite do proxy, nextUrl.origin pode não ser o do painel.
  const origin = requestOrigin(request.headers) ?? request.nextUrl.origin;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "";
  // Só caminhos do próprio painel: nada de redirecionar para fora do site.
  const next = safeAdminPath(nextParam);

  const supabase = await createClient();
  let error: { message: string } | null = null;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else {
    error = { message: searchParams.get("error_description") ?? "link sem código" };
  }

  if (error) {
    console.warn("[senha] link recusado:", error.message);
    return NextResponse.redirect(new URL("/login?erro=link", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
