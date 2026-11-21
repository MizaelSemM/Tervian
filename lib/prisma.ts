import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";
import { env } from "@/lib/env";

/**
 * Prisma Client "cru" (Prisma 7 + driver adapter do Postgres).
 *
 * ⚠️ REGRA DO PROJETO (tarefa 004): dados de conta passam SEMPRE pelo client de
 * tenant — `tenantDb()` em `lib/tenant-prisma.ts` — que injeta `account_id` em
 * todas as consultas. Este client aqui é só para operações de SISTEMA:
 * onboarding, autenticação, scripts e manutenção. Nunca use em features de conta.
 *
 * Em dev o Next recarrega os módulos a cada mudança; o cache em globalThis
 * evita abrir um pool de conexões novo a cada reload.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });

  return new PrismaClient({ adapter });
}

export const prismaBase = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaBase;
}
