import { env } from "@/lib/env";
import { sanitizeAnalyticsProps, type SafeProps } from "@/lib/privacy";
import { getTenantContext } from "@/lib/tenant-context";

/**
 * Instrumentação de produto (tarefa 005; PostHog na 013).
 *
 * Ponto único para eventos de produto. Em desenvolvimento imprime no console;
 * com `NEXT_PUBLIC_POSTHOG_KEY` configurada, envia para o PostHog via HTTP
 * (sem SDK no bundle do servidor).
 *
 * REGRAS:
 * - NUNCA enviar PII (nome, telefone, e-mail). As chaves são filtradas aqui,
 *   além da responsabilidade de quem chama.
 * - Todo evento carrega `account_id` e `role` do contexto de tenant, que são
 *   a base das métricas de adoção por vendedor (seção 4 do PRD).
 * - Analytics NUNCA derruba o fluxo de negócio.
 */

export type AnalyticsProps = SafeProps;

function posthogCapture(event: string, properties: AnalyticsProps): void {
  const apiKey = env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;

  const host = (env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com").replace(/\/$/, "");
  const context = getTenantContext();

  // Fire-and-forget: uma falha de analytics não pode atrasar a resposta.
  void fetch(`${host}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      event,
      distinct_id: context?.userId ?? context?.accountId ?? "system",
      properties,
      timestamp: new Date().toISOString(),
    }),
  }).catch((error) => {
    console.error("[analytics] Falha ao enviar evento:", error);
  });
}

export function trackEvent(name: string, props: AnalyticsProps = {}): void {
  try {
    const context = getTenantContext();
    const properties = sanitizeAnalyticsProps({
      ...props,
      account_id: context?.accountId,
      role: context?.role,
    });

    if (process.env.NODE_ENV !== "production") {
      console.info(`[analytics] ${name}`, properties);
    }

    posthogCapture(name, properties);
  } catch (error) {
    console.error("[analytics] Falha ao registrar evento:", error);
  }
}
