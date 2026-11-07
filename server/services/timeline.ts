import { Prisma } from "@/lib/generated/prisma/client";
import { requireTenantContext } from "@/lib/tenant-context";
import { tenantDb, type TenantClient, type TenantTransactionClient } from "@/lib/tenant-prisma";

export type TimelineEventInput = {
  type: string;
  payload?: Record<string, unknown>;
  dealId?: string | null;
  contactId?: string | null;
  actorId?: string | null;
  client?: TenantClient | TenantTransactionClient;
};

/**
 * Serviço único de eventos da timeline (tarefa 008).
 *
 * A timeline é imutável: este serviço só insere. A correção de um evento é
 * feita por um novo evento, nunca por update/delete.
 *
 * O `client` opcional permite reutilizar o mesmo `$transaction` do chamador.
 */
export async function logEvent(input: TimelineEventInput) {
  const db = input.client ?? tenantDb();
  const accountId = requireTenantContext().accountId;

  return db.timelineEvent.create({
    data: {
      accountId,
      type: input.type,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      dealId: input.dealId ?? null,
      contactId: input.contactId ?? null,
      actorId: input.actorId ?? null,
    },
  });
}
