import { requireTenantContext } from "@/lib/tenant-context";
import type { MessageTemplateListItem } from "@/lib/message-template";
import { createTenantClient, tenantDb, type TenantClient } from "@/lib/tenant-prisma";
import { AppError } from "@/server/errors";
import { ensureDefaultPipeline, type StageRef } from "@/server/services/pipeline";

/**
 * Modelos de mensagem (RF-36) — tarefa 019.
 *
 * Toda conta nasce com modelos genéricos para o primeiro contato funcionar no
 * dia 1. O admin pode criar, editar e excluir em Configurações; vendedores só
 * leem e usam na tela "Hoje" e nos detalhes de contato/negócio.
 *
 * Os IDs dos modelos padrão são determinísticos por conta, então o seed é
 * idempotente (mesmo padrão de funil e motivos de perda).
 */

type DefaultMessageTemplate = {
  key: string;
  name: string;
  body: string;
  /** Posição da etapa sugerida no funil padrão; `null` = sem sugestão. */
  stagePosition: number | null;
};

export const DEFAULT_MESSAGE_TEMPLATES: readonly DefaultMessageTemplate[] = [
  {
    key: "primeiro-contato",
    name: "Primeiro contato",
    body: "Oi, {nome}! Meu nome é {vendedor}, da equipe comercial. Vi que você se interessou e queria entender melhor o que precisa. Podemos conversar hoje?",
    stagePosition: 1,
  },
  {
    key: "retorno-combinado",
    name: "Retorno combinado",
    body: "Oi, {nome}! Conforme combinamos, estou retornando sobre a conversa com a {empresa}. Conseguiu pensar no que discutimos?",
    stagePosition: 2,
  },
  {
    key: "proposta-enviada",
    name: "Proposta enviada",
    body: "Oi, {nome}! Passando para saber se você conseguiu ver a proposta que enviei para a {empresa}. Ficou alguma dúvida?",
    stagePosition: 3,
  },
  {
    key: "fechamento",
    name: "Fechamento",
    body: "Oi, {nome}! Estamos quase lá. Queria confirmar os últimos detalhes com a {empresa} e entender o que falta para a gente fechar. Posso te ligar hoje?",
    stagePosition: 4,
  },
  {
    key: "reativacao",
    name: "Reativação",
    body: "Oi, {nome}! Faz um tempo que não conversamos sobre a {empresa}. Ainda faz sentido retomarmos? Se preferir, te atualizo rapidinho.",
    stagePosition: null,
  },
];

function defaultTemplateId(accountId: string, key: string): string {
  return `default-message-template-${accountId}-${key}`;
}

async function seedMessageTemplates(
  db: TenantClient,
  accountId: string,
  stages: StageRef[],
): Promise<void> {
  for (const template of DEFAULT_MESSAGE_TEMPLATES) {
    const stage =
      template.stagePosition === null
        ? null
        : (stages.find((candidate) => candidate.position === template.stagePosition) ?? null);

    await db.messageTemplate.upsert({
      where: { id: defaultTemplateId(accountId, template.key) },
      create: {
        id: defaultTemplateId(accountId, template.key),
        accountId,
        name: template.name,
        body: template.body,
        suggestedStageId: stage?.id ?? null,
      },
      // Nunca sobrescreve o que o admin já editou.
      update: {},
    });
  }
}

/** Cria os modelos padrão no cadastro (ainda sem contexto de request). */
export async function createDefaultMessageTemplatesForAccount(accountId: string): Promise<void> {
  const db = createTenantClient(accountId);
  const stages = await db.stage.findMany({
    orderBy: { position: "asc" },
    select: { id: true, name: true, position: true, probability: true },
  });
  await seedMessageTemplates(db, accountId, stages);
}

/**
 * Garante os modelos em contas anteriores à 019. Só faz o trabalho pesado
 * quando a conta ainda não tem nenhum modelo (o caso normal é uma leitura).
 */
export async function ensureDefaultMessageTemplates(): Promise<void> {
  const db = tenantDb();
  const count = await db.messageTemplate.count();
  if (count > 0) return;

  const { stages } = await ensureDefaultPipeline();
  await seedMessageTemplates(db, requireTenantContext().accountId, stages);
}

/** Modelos da conta atual, em ordem alfabética, com o nome da etapa sugerida. */
export async function listMessageTemplates(): Promise<MessageTemplateListItem[]> {
  await ensureDefaultMessageTemplates();

  const rows = await tenantDb().messageTemplate.findMany({
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      body: true,
      suggestedStageId: true,
      suggestedStage: { select: { name: true } },
    },
  });

  return rows.map(({ suggestedStage, ...row }) => ({
    ...row,
    suggestedStageName: suggestedStage?.name ?? null,
  }));
}

async function assertStageBelongsToAccount(stageId: string | undefined): Promise<string | null> {
  if (!stageId) return null;

  const stage = await tenantDb().stage.findFirst({
    where: { id: stageId },
    select: { id: true },
  });
  if (!stage) {
    throw new AppError("TEMPLATE_STAGE_INVALID", "Etapa inválida para esta conta.");
  }
  return stage.id;
}

async function assertNameAvailable(name: string, ignoreId?: string): Promise<void> {
  const duplicate = await tenantDb().messageTemplate.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new AppError("TEMPLATE_NAME_TAKEN", "Já existe um modelo com esse nome.");
  }
}

export type CreateMessageTemplateInput = {
  name: string;
  body: string;
  suggestedStageId?: string;
};

export async function createMessageTemplate(
  input: CreateMessageTemplateInput,
): Promise<{ id: string }> {
  await assertNameAvailable(input.name);
  const suggestedStageId = await assertStageBelongsToAccount(input.suggestedStageId);

  return tenantDb().messageTemplate.create({
    data: {
      accountId: requireTenantContext().accountId,
      name: input.name,
      body: input.body,
      suggestedStageId,
    },
    select: { id: true },
  });
}

export type UpdateMessageTemplateInput = CreateMessageTemplateInput & { id: string };

export async function updateMessageTemplate(input: UpdateMessageTemplateInput): Promise<void> {
  const existing = await tenantDb().messageTemplate.findFirst({
    where: { id: input.id },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError("TEMPLATE_NOT_FOUND", "Modelo não encontrado nesta conta.");
  }

  await assertNameAvailable(input.name, existing.id);
  const suggestedStageId = await assertStageBelongsToAccount(input.suggestedStageId);

  await tenantDb().messageTemplate.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      body: input.body,
      suggestedStageId,
    },
  });
}

export async function deleteMessageTemplate(id: string): Promise<void> {
  const existing = await tenantDb().messageTemplate.findFirst({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError("TEMPLATE_NOT_FOUND", "Modelo não encontrado nesta conta.");
  }

  await tenantDb().messageTemplate.delete({ where: { id: existing.id } });
}
