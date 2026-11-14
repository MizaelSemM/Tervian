import type { Instrumentation } from "next";

/**
 * Observabilidade de erros de servidor (tarefa 013).
 *
 * O hook `onRequestError` do Next captura erros de RSC, Route Handlers,
 * Server Actions e proxy. Reportamos para o Sentry (quando `SENTRY_DSN` está
 * configurado) via `reportError()`, que mascara e-mail/telefone e remove PII
 * do contexto antes de sair da aplicação.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // O AsyncLocalStorage do tenant e o fetch de saída são do runtime Node.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { reportError } = await import("./lib/observability");

  await reportError(error, {
    route: request.path,
    extra: {
      method: request.method,
      route_type: context.routeType,
      route_path: context.routePath,
    },
  });
};
