import { trackEvent } from "@/lib/analytics";
import { env } from "@/lib/env";
import { sanitizeAnalyticsProps, scrubErrorText } from "@/lib/privacy";
import { getTenantContext } from "@/lib/tenant-context";

/**
 * Reporte de erros (tarefa 013).
 *
 * Integra com o Sentry sem o SDK: enviamos o evento para o endpoint do DSN
 * (protocolo `store`). Vantagem: nada entra no bundle do cliente e o build não
 * depende de configuração de sourcemaps.
 *
 * Regras de privacidade:
 * - e-mail e telefone são mascarados na mensagem;
 * - `extra` passa pelo mesmo filtro do analytics (sem nome/telefone/e-mail);
 * - o usuário vai apenas como ID, nunca com nome ou e-mail.
 */

function parseSentryDsn(dsn: string): { endpoint: string; publicKey: string } | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+/, "");
    if (!url.username || !projectId) return null;
    return {
      endpoint: `https://${url.host}/api/${projectId}/store/`,
      publicKey: url.username,
    };
  } catch {
    return null;
  }
}

export type ErrorContext = {
  route?: string;
  extra?: Record<string, string | number | boolean | null | undefined>;
};

export async function reportError(error: unknown, context: ErrorContext = {}): Promise<void> {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = scrubErrorText(err.message || "Erro desconhecido");
    const tenant = getTenantContext();
    // `extra` nunca leva PII: as chaves sensíveis são removidas aqui.
    const extra = sanitizeAnalyticsProps(context.extra ?? {});

    console.error("[error]", message, context.route ?? "", extra);

    if (env.SENTRY_DSN) {
      const sentry = parseSentryDsn(env.SENTRY_DSN);
      if (sentry) {
        await fetch(sentry.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${sentry.publicKey}, sentry_client=tervian/1.0`,
          },
          body: JSON.stringify({
            event_id: crypto.randomUUID().replace(/-/g, ""),
            timestamp: new Date().toISOString(),
            platform: "node",
            level: "error",
            environment: process.env.NODE_ENV,
            message: { formatted: message },
            exception: { values: [{ type: err.name, value: message }] },
            tags: {
              account_id: tenant?.accountId,
              role: tenant?.role,
              route: context.route,
            },
            user: tenant?.userId ? { id: tenant.userId } : undefined,
            extra,
          }),
        }).catch((sendError) => {
          console.error("[error] Falha ao enviar para o Sentry:", sendError);
        });
      }
    }

    // Fallback/observabilidade de produto: o erro também aparece no PostHog
    // (quando configurado), já sem PII.
    trackEvent("$exception", { message, route: context.route, ...extra });
  } catch (reportingError) {
    console.error("[error] Falha ao reportar erro:", reportingError);
  }
}
