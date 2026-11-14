import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Contexto de conta (tenant) por requisição — tarefa 004.
 *
 * A tarefa 003 (auth) vai abrir o contexto no início de cada request:
 *
 *   runWithTenant({ accountId: sessão.accountId, userId: sessão.userId }, () => handler())
 *
 * Todo o código de domínio lê o `accountId` DAQUI — nunca de parâmetro vindo do
 * client. `tenantDb()` (lib/tenant-prisma.ts) usa este contexto para estender o
 * Prisma com o filtro automático de conta.
 */
export type TenantContext = {
  accountId: string;
  userId?: string;
  /** Papel do usuário na conta — usado apenas em analytics (nunca em autorização). */
  role?: "ADMIN" | "SELLER";
};

const storage = new AsyncLocalStorage<TenantContext>();

export class TenantContextMissingError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "Nenhum contexto de conta ativo nesta execução. Abra o contexto com runWithTenant() (request) ou use createTenantClient() (testes/scripts).",
    );
    this.name = "TenantContextMissingError";
  }
}

/** Executa `fn` com o contexto de conta ativo (propaga por promises/async). */
export function runWithTenant<T>(context: TenantContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Contexto atual, ou undefined se não houver. */
export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

/** Contexto atual; lança se não houver (uso em código que EXIGE tenant). */
export function requireTenantContext(): TenantContext {
  const context = storage.getStore();
  if (!context) throw new TenantContextMissingError();
  return context;
}
