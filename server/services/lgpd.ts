import { requireTenantContext } from "@/lib/tenant-context";
import { tenantDb } from "@/lib/tenant-prisma";
import { AppError } from "@/server/errors";
import type { ActingUser } from "@/server/services/owners";

/**
 * Remoção definitiva de contato (LGPD, tarefa 013).
 *
 * Diferente da exclusão lógica do dia a dia (`deletedAt`), aqui os dados são
 * apagados de verdade: contato, negócios, tarefas, notas e eventos da timeline.
 * O evento de auditoria `contact.purged` fica sem vínculo com o contato (só o
 * id), para registrar quem pediu e quando sem manter dado pessoal.
 *
 * A timeline é imutável por padrão (ver 008); a exclusão por LGPD é a única
 * exceção documentada — o direito do titular prevalece sobre o histórico.
 */
export async function purgeContact(input: {
  contactId: string;
  actingUser: ActingUser;
}): Promise<{ deals: number; tasks: number; notes: number; events: number }> {
  if (input.actingUser.role !== "ADMIN") {
    throw new AppError("FORBIDDEN", "Apenas o administrador pode excluir dados definitivamente.");
  }

  const accountId = requireTenantContext().accountId;
  const db = tenantDb();

  const contact = await db.contact.findFirst({
    where: { id: input.contactId },
    select: { id: true },
  });
  if (!contact) {
    throw new AppError("CONTACT_NOT_FOUND", "Contato não encontrado nesta conta.");
  }

  const deals = await db.deal.findMany({
    where: { contactId: contact.id },
    select: { id: true },
  });
  const dealIds = deals.map((deal) => deal.id);

  const counts = await db.$transaction(async (tx) => {
    const tasks = await tx.task.deleteMany({ where: { dealId: { in: dealIds } } });
    const notes = await tx.note.deleteMany({
      where: { OR: [{ contactId: contact.id }, { dealId: { in: dealIds } }] },
    });
    const events = await tx.timelineEvent.deleteMany({
      where: { OR: [{ contactId: contact.id }, { dealId: { in: dealIds } }] },
    });
    await tx.deal.deleteMany({ where: { id: { in: dealIds } } });
    await tx.contact.deleteMany({ where: { id: contact.id } });

    // Auditoria sem PII: o id do contato não permite reidentificar o titular.
    await tx.timelineEvent.create({
      data: {
        accountId,
        type: "contact.purged",
        payload: { contactId: contact.id, deals: dealIds.length, actorId: input.actingUser.id },
        actorId: input.actingUser.id,
      },
    });

    return {
      deals: dealIds.length,
      tasks: tasks.count,
      notes: notes.count,
      events: events.count,
    };
  });

  return counts;
}
