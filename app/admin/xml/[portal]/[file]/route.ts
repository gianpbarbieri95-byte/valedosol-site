import { NextResponse, type NextRequest } from "next/server";
import { isAdminHost } from "@/lib/admin-host";
import { isPortalId } from "@/lib/portals/definitions";
import { buildPortalFeed } from "@/lib/portals/feed";

/**
 * XML dos portais: https://admin.valedosolimoveis.com.br/xml/<portal>/<token>.xml
 *
 * O portal busca este endereço sozinho, sem login — quem protege é o token
 * (portal_settings.feed_token), conferido em buildPortalFeed. Portal
 * desligado, token errado ou portal desconhecido: 404, igual para os três.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ portal: string; file: string }> }) {
  // Route Handler não passa pelo app/admin/layout.tsx: repete a trava de host.
  if (!isAdminHost(request.headers.get("host"))) return new NextResponse(null, { status: 404 });

  const { portal, file } = await params;
  const token = file.endsWith(".xml") ? file.slice(0, -4) : "";
  if (!isPortalId(portal) || !/^[a-f0-9]{16,128}$/.test(token)) return new NextResponse(null, { status: 404 });

  const result = await buildPortalFeed(portal, token);

  if (result.status === "not-found") return new NextResponse(null, { status: 404 });
  if (result.status === "unavailable") {
    return new NextResponse("Feed temporariamente indisponível.", {
      status: 503,
      headers: { "Retry-After": "600", "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new NextResponse(result.xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Os portais leem de hora em hora (ou uma vez por dia): 10 minutos de
      // cache na borda poupam o banco sem atrasar atualização que importe.
      "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=600",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
