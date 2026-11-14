import { getSession } from "@/lib/session";
import { runWithTenant } from "@/lib/tenant-context";
import { tenantDb } from "@/lib/tenant-prisma";
import { AppError } from "@/server/errors";
import { getContact } from "@/server/services/contacts";
import type { ActingUser } from "@/server/services/owners";

/**
 * Exportação de dados (LGPD, tarefa 013).
 *
 * `GET /api/lgpd/export` exporta a conta inteira (somente ADMIN).
 * `GET /api/lgpd/export?contato=<id>` exporta um contato e tudo que está
 * ligado a ele (qualquer usuário com acesso ao contato).
 *
 * O JSON é baixado como anexo e nunca fica em cache. Dados de autenticação
 * (hash de senha, tokens, sessões) NUNCA entram no arquivo. A rota é dinâmica
 * por natureza (lê a sessão via cookies); não usamos `export const dynamic`
 * porque o Cache Components do Next 16 não permite esse segmento.
 */

function actingUserFrom(session: NonNullable<Awaited<ReturnType<typeof getSession>>>): ActingUser {
  return {
    id: session.user.id,
    role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
  };
}

function fileResponse(body: unknown, fileName: string): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user.active || !session.user.accountId || !session.user.role) {
    return new Response("Não autenticado.", { status: 401 });
  }

  const contactId = new URL(request.url).searchParams.get("contato");
  if (!contactId && session.user.role !== "ADMIN") {
    return new Response("A exportação da conta é restrita ao administrador.", { status: 403 });
  }

  try {
    const payload = await runWithTenant(
      {
        accountId: session.user.accountId,
        userId: session.user.id,
        role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
      },
      async () => {
        const db = tenantDb();
        const actingUser = actingUserFrom(session);

        const account = await db.account.findFirstOrThrow({
          select: {
            id: true,
            name: true,
            plan: true,
            timezone: true,
            createdAt: true,
            termsAcceptedAt: true,
            termsVersion: true,
          },
        });

        const users = await db.user.findMany({
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
        });

        if (contactId) {
          const contact = await getContact({ id: contactId, actingUser });
          if (!contact) throw new AppError("CONTACT_NOT_FOUND", "Contato não encontrado.");

          const deals = await db.deal.findMany({
            where: { contactId },
            orderBy: { createdAt: "asc" },
          });
          const dealIds = deals.map((deal) => deal.id);
          const tasks = await db.task.findMany({
            where: { dealId: { in: dealIds } },
            orderBy: { dueAt: "asc" },
          });
          const notes = await db.note.findMany({
            where: { OR: [{ contactId }, { dealId: { in: dealIds } }] },
            orderBy: { createdAt: "asc" },
          });
          const timeline = await db.timelineEvent.findMany({
            where: { OR: [{ contactId }, { dealId: { in: dealIds } }] },
            orderBy: { createdAt: "asc" },
          });

          return {
            exportedAt: new Date().toISOString(),
            scope: "contact",
            account,
            contact,
            deals,
            tasks,
            notes,
            timeline,
          };
        }

        const [contacts, deals, tasks, notes, timeline] = await Promise.all([
          db.contact.findMany({ orderBy: { createdAt: "asc" } }),
          db.deal.findMany({ orderBy: { createdAt: "asc" } }),
          db.task.findMany({ orderBy: { dueAt: "asc" } }),
          db.note.findMany({ orderBy: { createdAt: "asc" } }),
          db.timelineEvent.findMany({ orderBy: { createdAt: "asc" } }),
        ]);

        return {
          exportedAt: new Date().toISOString(),
          scope: "account",
          account,
          users,
          contacts,
          deals,
          tasks,
          notes,
          timeline,
        };
      },
    );

    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = contactId
      ? `tervian-contato-${contactId}-${stamp}.json`
      : `tervian-conta-${session.user.accountId}-${stamp}.json`;
    return fileResponse(payload, fileName);
  } catch (error) {
    if (error instanceof AppError) {
      const status = error.code === "CONTACT_NOT_FOUND" ? 404 : 403;
      return new Response(error.message, { status });
    }
    console.error("[lgpd] Falha na exportação de dados:", error);
    return new Response("Não foi possível exportar os dados agora.", { status: 500 });
  }
}
