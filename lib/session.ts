import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { runWithTenant } from "@/lib/tenant-context";

/**
 * Sessão e autorização (tarefa 003).
 *
 * Fluxo padrão de uma página/action protegida:
 *
 *   const session = await requireAuth();                    // ou requireRole("ADMIN")
 *   const dados = await withSession(async (session) => { ... tenantDb() ... });
 *
 * A validação é REAL (consulta a sessão no banco — o proxy só faz uma checagem
 * otimista do cookie). `getSession` é memoizada por request (React `cache`),
 * então layout + página + actions do mesmo request compartilham a leitura.
 */

/** Sessão autenticada (shape inferido da configuração do Better Auth, com additionalFields). */
export type AuthedSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

/** Sessão atual, ou null. Validação real no banco; memoizada por request. */
export const getSession = cache(async (): Promise<AuthedSession | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ?? null;
});

/**
 * Exige login E usuário ativo; sem isso, redireciona para /login.
 * (Usuário desativado pode ter sessão válida no banco — o `active` barra aqui e
 * o `session.create.before` barra novos logins; ver lib/auth.ts.)
 */
export async function requireAuth(): Promise<AuthedSession> {
  const session = await getSession();
  if (!session || !session.user.active || !session.user.accountId) redirect("/login");
  return session;
}

/** Exige um papel específico; sem isso, redireciona para a home. */
export async function requireRole(role: "ADMIN" | "SELLER"): Promise<AuthedSession> {
  const session = await requireAuth();
  if (session.user.role !== role) redirect("/");
  return session;
}

/**
 * Executa `fn` com o contexto de tenant aberto (lib/tenant-context) — dentro
 * dele, `tenantDb()` é o único client permitido para dados de domínio.
 */
export async function withSession<T>(fn: (session: AuthedSession) => Promise<T>): Promise<T> {
  const session = await requireAuth();
  const accountId = session.user.accountId;
  if (!accountId) redirect("/login"); // narrow do TS — requireAuth já barra isto
  return runWithTenant(
    {
      accountId,
      userId: session.user.id,
      role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
    },
    () => fn(session),
  );
}

/** Igual a `withSession`, mas só para ADMIN. */
export async function withAdmin<T>(fn: (session: AuthedSession) => Promise<T>): Promise<T> {
  const session = await requireRole("ADMIN");
  const accountId = session.user.accountId;
  if (!accountId) redirect("/login"); // narrow do TS — requireAuth já barra isto
  return runWithTenant(
    {
      accountId,
      userId: session.user.id,
      role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
    },
    () => fn(session),
  );
}
