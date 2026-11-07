import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy do Next (o antigo `middleware`, renomeado no Next 16) — tarefa 003.
 *
 * Checagem OTIMISTA: só verifica se o cookie de sessão existe, para não pagar
 * uma consulta de banco em cada navegação. A validação REAL (sessão no banco +
 * usuário ativo + papel) acontece em cada página/layout/action via
 * `requireAuth()`/`requireRole()` (lib/session.ts) — o proxy é a primeira
 * barreira, nunca a única. Ver .notes/003 para o porquê desse desenho.
 */

const PUBLIC_PATHS = [
  "/login",
  "/cadastro",
  "/esqueci-senha",
  "/redefinir-senha",
  "/convite",
  "/f",
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (isPublic) return NextResponse.next();

  if (getSessionCookie(request)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") {
    // Só caminho interno: o formulário de login sanitiza antes de navegar.
    loginUrl.searchParams.set("redirect", `${pathname}${search}`);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  /**
   * Roda em tudo, MENOS:
   * - `/api/*` (rota do Better Auth e futuras APIs — autenticam por conta própria);
   * - assets internos do Next e qualquer arquivo estático (caminho com ponto).
   */
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
