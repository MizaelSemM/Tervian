import { Prisma } from "@/lib/generated/prisma/client";
import { trackEvent } from "@/lib/analytics";
import { normalizePhoneBR } from "@/lib/phone";
import type { ContactOrigin } from "@/lib/schemas/contact";
import { requireTenantContext } from "@/lib/tenant-context";
import { tenantDb } from "@/lib/tenant-prisma";
import { AppError } from "@/server/errors";
import { resolveOwnerId, type ActingUser } from "@/server/services/owners";
import { ensureDefaultPipeline } from "@/server/services/pipeline";
import { logEvent } from "@/server/services/timeline";

/**
 * Captura de lead — serviço único da tarefa 005 (US-03).
 *
 * Regra do PRD: nome + telefone criam, na mesma transação:
 *   contato → negócio na etapa "Novo" (responsável = quem capturou) →
 *   tarefa "Primeiro contato" para hoje → evento na timeline.
 *
 * Reutilizado pelo cadastro manual (005), importação CSV (009) e formulário
 * público (010) — por isso valida tudo de novo e não depende de UI.
 *
 * Duplicado por telefone NÃO é erro: devolve `status: "duplicate"` com o
 * contato existente para a tela oferecer "abrir contato" (inclusive contato
 * excluído — o telefone continua único no banco).
 */

export type LeadSource = "manual" | "form" | "csv" | "api";

export type CreateLeadInput = {
  actingUser: ActingUser;
  name: string;
  /** Telefone cru (com máscara, DDI ou não) — normalizado aqui. */
  phone: string;
  email?: string | null;
  companyText?: string | null;
  origin?: ContactOrigin | null;
  ownerId?: string | null;
  source?: LeadSource;
  /** Tempo entre abrir o formulário e salvar (métrica "< 20s", ver 013). */
  captureSeconds?: number;
  /**
   * Cria negócio + tarefa de primeiro contato (padrão) ou só o contato.
   * A importação CSV usa `false` na opção "importar apenas contatos".
   */
  createDeal?: boolean;
};

export type DuplicateContact = {
  id: string;
  name: string;
  phone: string;
  deleted: boolean;
};

export type CreateLeadResult =
  | { status: "created"; contactId: string; dealId: string; taskId: string }
  | { status: "created-contact"; contactId: string }
  | { status: "duplicate"; contact: DuplicateContact };

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function optionalEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function findDuplicate(phone: string): Promise<DuplicateContact | null> {
  const existing = await tenantDb().contact.findFirst({
    where: { phone },
    select: { id: true, name: true, phone: true, deletedAt: true },
  });
  if (!existing) return null;
  return {
    id: existing.id,
    name: existing.name,
    phone: existing.phone,
    deleted: existing.deletedAt !== null,
  };
}

export async function createLead(input: CreateLeadInput): Promise<CreateLeadResult> {
  const name = input.name.trim();
  if (name.length < 2) {
    throw new AppError("LEAD_NAME_INVALID", "Informe o nome do contato (mín. 2 caracteres).");
  }

  const phone = normalizePhoneBR(input.phone);
  if (!phone) {
    throw new AppError(
      "LEAD_PHONE_INVALID",
      "Telefone inválido. Use DDD + número (ex.: (11) 98765-4321).",
    );
  }

  const duplicate = await findDuplicate(phone);
  if (duplicate) return { status: "duplicate", contact: duplicate };

  const db = tenantDb();
  const accountId = requireTenantContext().accountId;
  const ownerId = await resolveOwnerId(db, input.actingUser, input.ownerId);
  const { newStage } = await ensureDefaultPipeline();

  const now = new Date();
  const source = input.source ?? "manual";
  const origin = input.origin ?? "OTHER";
  const createDeal = input.createDeal ?? true;
  // Tarefa "para hoje": vence agora, para entrar na tela "Hoje" sem esperar
  // um horário fixo (o vendedor já pode chamar no mesmo minuto).
  const dueAt = now;

  try {
    const created = await db.$transaction(async (tx) => {
      const contact = await tx.contact.create({
        data: {
          accountId,
          name,
          phone,
          email: optionalEmail(input.email),
          companyText: optionalText(input.companyText),
          origin,
          ownerId,
        },
        select: { id: true },
      });

      if (!createDeal) {
        await logEvent({
          type: "contact.created",
          payload: { source, origin },
          contactId: contact.id,
          actorId: input.actingUser.id,
          client: tx,
        });
        return { status: "created-contact" as const, contactId: contact.id };
      }

      const deal = await tx.deal.create({
        data: {
          accountId,
          title: name,
          stageId: newStage.id,
          contactId: contact.id,
          ownerId,
          lastActivityAt: now,
          nextActionAt: dueAt,
        },
        select: { id: true },
      });

      const task = await tx.task.create({
        data: {
          accountId,
          dealId: deal.id,
          ownerId,
          type: "WHATSAPP",
          title: "Primeiro contato",
          dueAt,
        },
        select: { id: true },
      });

      await logEvent({
        type: "deal.created",
        payload: {
          title: name,
          stage: newStage.name,
          source,
          // Número puro (sem PII) usado nas métricas de produto (013).
          seconds: input.captureSeconds ?? null,
        },
        dealId: deal.id,
        contactId: contact.id,
        actorId: input.actingUser.id,
        client: tx,
      });

      return {
        status: "created" as const,
        contactId: contact.id,
        dealId: deal.id,
        taskId: task.id,
      };
    });

    if (created.status === "created-contact") {
      trackEvent("contact_created", { source, origin });
      return created;
    }

    trackEvent("lead_created", {
      source,
      origin,
      seconds: input.captureSeconds,
      created_in_seconds: input.captureSeconds,
      has_email: Boolean(input.email),
      has_company: Boolean(input.companyText),
    });

    return created;
  } catch (error) {
    // Corrida entre duas capturas do mesmo telefone: o índice único decide;
    // devolvemos o contato que venceu, em vez de estourar erro na tela.
    if (isUniqueConstraintError(error)) {
      const raced = await findDuplicate(phone);
      if (raced) return { status: "duplicate", contact: raced };
    }
    throw error;
  }
}
