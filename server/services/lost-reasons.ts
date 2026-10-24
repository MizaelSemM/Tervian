import { requireTenantContext } from "@/lib/tenant-context";
import { createTenantClient, tenantDb, type TenantClient } from "@/lib/tenant-prisma";

/**
 * Motivos de perda (RF-23) — tarefa 006.
 *
 * O PRD pede uma "lista editável"; a edição fica para o P1 (`015`), mas toda
 * conta precisa nascer com uma lista utilizável para que "fechar como perdido"
 * funcione no primeiro dia. Os IDs são determinísticos por conta, então a
 * criação é idempotente mesmo com dois requests concorrentes.
 */

export const DEFAULT_LOST_REASONS = [
  "Preço",
  "Concorrência",
  "Sem resposta",
  "Momento ruim",
  "Outro",
] as const;

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function seedLostReasons(db: TenantClient, accountId: string): Promise<void> {
  for (const name of DEFAULT_LOST_REASONS) {
    await db.lostReason.upsert({
      where: { id: `default-lost-reason-${accountId}-${slugify(name)}` },
      create: {
        id: `default-lost-reason-${accountId}-${slugify(name)}`,
        accountId,
        name,
      },
      update: {},
    });
  }
}

/** Cria a lista padrão no cadastro (ainda sem contexto de request). */
export async function createDefaultLostReasonsForAccount(accountId: string): Promise<void> {
  await seedLostReasons(createTenantClient(accountId), accountId);
}

/**
 * Garante a lista em contas anteriores à 006. Só faz o trabalho pesado quando
 * a conta ainda não tem nenhum motivo (o caso normal é uma leitura por página).
 */
export async function ensureDefaultLostReasons(): Promise<void> {
  const db = tenantDb();
  const count = await db.lostReason.count();
  if (count > 0) return;
  await seedLostReasons(db, requireTenantContext().accountId);
}

export type LostReasonOption = { id: string; name: string };

/** Motivos ativos, em ordem alfabética, para o formulário de fechamento. */
export async function listLostReasons(): Promise<LostReasonOption[]> {
  await ensureDefaultLostReasons();
  return tenantDb().lostReason.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
