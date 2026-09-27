/**
 * Endereço do painel administrativo.
 *
 * O painel é servido só no subdomínio admin — em produção
 * admin.valedosolimoveis.com.br, no desenvolvimento admin.localhost:3000.
 * Os arquivos continuam em app/admin, mas ninguém os acessa por /admin:
 *
 *   - no host do painel, o proxy.ts reescreve /dashboard → /admin/dashboard
 *     (a barra de endereço mostra /dashboard);
 *   - em qualquer outro host (o site público), /admin responde 404.
 *
 * Por isso os links, redirects e `next` do painel usam os caminhos limpos
 * (/login, /dashboard, /imoveis…). Já o revalidatePath continua com
 * /admin/...: ele trabalha com o caminho do arquivo, não com o da barra.
 *
 * Arquivo neutro de propósito (sem next/headers nem SDK do Supabase): é
 * usado pelo proxy, por Server Components, Route Handlers e Server Actions.
 */

/**
 * Primeiro rótulo do hostname que identifica o painel. O matcher do proxy.ts
 * e o headers() do next.config.ts repetem esta regra ("admin\\..+") porque
 * lá o valor precisa ser literal.
 */
const ADMIN_SUBDOMAIN = "admin";

/** Pasta de app/ onde moram as rotas do painel (destino do rewrite). */
export const ADMIN_INTERNAL_PREFIX = "/admin";

/** Entrada de quem já está logado. */
export const ADMIN_HOME = "/dashboard";

/** Tela de login do painel. */
export const ADMIN_LOGIN = "/login";

/**
 * Indica se o host da requisição é o do painel. Aceita o valor do cabeçalho
 * Host como vem (com porta, no desenvolvimento).
 */
export function isAdminHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const labels = host.split(":", 1)[0].trim().toLowerCase().split(".");
  return labels.length > 1 && labels[0] === ADMIN_SUBDOMAIN;
}

/**
 * Endereço (esquema + host) pelo qual a requisição chegou, a partir dos
 * cabeçalhos. Depois do rewrite do proxy, request.nextUrl nos Route Handlers
 * nem sempre traz o host original — os cabeçalhos trazem.
 */
export function requestOrigin(requestHeaders: Headers): string | null {
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return null;
  const hostname = host.split(":", 1)[0];
  const isLocal = hostname === "localhost" || hostname.endsWith(".localhost") || hostname.startsWith("127.");
  const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim() || (isLocal ? "http" : "https");
  return `${protocol}://${host}`;
}

/**
 * Destino depois do login ou do link de senha: só caminhos do próprio painel,
 * sem esquema nem host — nada de redirecionar para fora (//outro-site.com
 * não passa).
 */
export function safeAdminPath(value: string | null | undefined): string {
  return value && /^(\/[\w-]+)+$/.test(value) ? value : ADMIN_HOME;
}
