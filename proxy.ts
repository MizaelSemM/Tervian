import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy do Next (o antigo `middleware`, renomeado no Next 16) — tarefa 003.
 *
 * Duas responsabilidades:
 *
 * 1. Checagem OTIMISTA de sessão: só verifica se o cookie existe, para não
 *    pagar uma consulta de banco em cada navegação. A validação REAL (sessão no
 *    banco + usuário ativo + papel) acontece em cada página/layout/action via
 *    `requireAuth()`/`requireRole()`. O proxy é a primeira barreira, nunca a
 *    única (ver .notes/003).
 * 2. Headers de segurança (tarefa 013): CSP, anti-clickjacking e `noindex` nas
 *    áreas privadas. O formulário público `/f/*` é a exceção: precisa ser
 *    embutido em sites de clientes (frame-ancestors liberado) e continua
 *    `noindex`.
 */

const PUBLIC_PATHS = [
  "/login",
  "/cadastro",
  "/esqueci-senha",
  "/redefinir-senha",
  "/convite",
  "/f",
  "/termos",
  "/privacidade",
];

const LEGAL_PATHS = ["/termos", "/privacidade"];

function isPublicForm(pathname: string): boolean {
  return pathname === "/f" || pathname.startsWith("/f/");
}

function securityHeaders(pathname: string): Headers {
  const headers = new Headers();
  const isDev = process.env.NODE_ENV !== "production";
  const publicForm = isPublicForm(pathname);

  // CSP básica: o Next injeta scripts/estilos inline (sem nonce), então
  // `unsafe-inline` é necessário. `unsafe-eval` fica restrito ao dev (Turbopack).
  const scriptSrc = `'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`;
  const connectSrc = `'self' https://*.posthog.com https://*.sentry.io${isDev ? " ws: wss:" : ""}`;

  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src ${connectSrc}`,
      "frame-src 'self'",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      // O formulário público é embedável; o resto do app não pode ser enquadrado.
      publicForm ? "frame-ancestors *" : "frame-ancestors 'none'",
    ].join("; "),
  );

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (!publicForm) headers.set("X-Frame-Options", "DENY");
  if (process.env.NODE_ENV === "production") {
    headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }

  // Só termos/privacidade e o formulário público podem ser indexados; o resto
  // é área privada (mesmo que uma URL vaze, não entra em buscadores).
  if (!publicForm && !LEGAL_PATHS.includes(pathname)) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return headers;
}

function nextWithHeaders(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  securityHeaders(request.nextUrl.pathname).forEach((value, key) => {
    response.headers.set(key, value);
  });
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (isPublic) return nextWithHeaders(request);

  if (getSessionCookie(request)) return nextWithHeaders(request);

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") {
    // Só caminho interno: o formulário de login sanitiza antes de navegar.
    loginUrl.searchParams.set("redirect", `${pathname}${search}`);
  }
  const redirectResponse = NextResponse.redirect(loginUrl);
  securityHeaders(pathname).forEach((value, key) => {
    redirectResponse.headers.set(key, value);
  });
  return redirectResponse;
}

export const config = {
  /**
   * Roda em tudo, MENOS:
   * - `/api/*` (rota do Better Auth e futuras APIs — autenticam por conta própria);
   * - assets internos do Next e qualquer arquivo estático (caminho com ponto).
   */
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
