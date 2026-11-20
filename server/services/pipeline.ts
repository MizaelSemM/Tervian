import {
  PIPELINE_STAGE_NAME_MAX,
  PIPELINE_STAGE_NAME_MIN,
  PIPELINE_STAGE_PROBABILITY_MAX,
  PIPELINE_STAGE_PROBABILITY_MIN,
  type PipelineStageUpdate,
} from "@/lib/pipeline";
import { requireTenantContext } from "@/lib/tenant-context";
import { createTenantClient, tenantDb, type TenantClient } from "@/lib/tenant-prisma";
import { AppError } from "@/server/errors";

/**
 * Funil padrão do MVP (RF-20) — tarefa 005.
 *
 * Novo → Contatado → Proposta enviada → Negociação. Ganho/Perdido são
 * `DealStatus` (não etapas; ver 002), então o kanban monta as colunas terminais
 * a partir do status.
 *
 * O funil é criado no cadastro da empresa e GARANTIDO no primeiro lead
 * (`ensureDefaultPipeline`), para contas anteriores à 005 também funcionarem.
 * Os IDs são determinísticos por conta — dois `createLead()` concorrentes não
 * duplicam o funil (upsert idempotente).
 *
 * Desde a RF-24 o admin pode renomear, reordenar e ajustar a probabilidade das
 * etapas em Configurações. A PRIMEIRA etapa (posição 1) é a entrada de novos
 * leads, então renomear "Novo" ou mudar a ordem não quebra a captura.
 */

export const DEFAULT_PIPELINE_NAME = "Comercial";
export const DEFAULT_NEW_STAGE_NAME = "Novo";

const DEFAULT_STAGES = [
  { name: DEFAULT_NEW_STAGE_NAME, position: 1, probability: 10, cadenceDays: null },
  { name: "Contatado", position: 2, probability: 25, cadenceDays: 3 },
  { name: "Proposta enviada", position: 3, probability: 50, cadenceDays: 2 },
  { name: "Negociação", position: 4, probability: 75, cadenceDays: 2 },
] as const;

export type StageRef = { id: string; name: string; position: number; probability: number };
export type DefaultPipeline = {
  pipelineId: string;
  newStage: StageRef;
  stages: StageRef[];
};

async function seedStages(
  db: TenantClient,
  accountId: string,
  pipelineId: string,
): Promise<StageRef[]> {
  const stages: StageRef[] = [];
  for (const stage of DEFAULT_STAGES) {
    const row = await db.stage.upsert({
      where: { id: `default-stage-${pipelineId}-${stage.position}` },
      create: {
        id: `default-stage-${pipelineId}-${stage.position}`,
        accountId,
        pipelineId,
        name: stage.name,
        position: stage.position,
        probability: stage.probability,
        cadenceDays: stage.cadenceDays,
      },
      update: {},
      select: { id: true, name: true, position: true, probability: true },
    });
    stages.push(row);
  }
  return stages;
}

async function seedPipeline(db: TenantClient, accountId: string): Promise<DefaultPipeline> {
  const pipelineId = `default-pipeline-${accountId}`;
  await db.pipeline.upsert({
    where: { id: pipelineId },
    create: { id: pipelineId, accountId, name: DEFAULT_PIPELINE_NAME },
    update: {},
  });

  const stages = await seedStages(db, accountId, pipelineId);
  return { pipelineId, newStage: stages[0], stages };
}

/**
 * Cria o funil padrão para uma conta (usado no cadastro, quando ainda não há
 * contexto de request). Idempotente.
 */
export async function createDefaultPipelineForAccount(accountId: string): Promise<DefaultPipeline> {
  return seedPipeline(createTenantClient(accountId), accountId);
}

/**
 * Garante um funil na conta atual. Usado por `createLead()` para contas criadas
 * antes da 005 (ex.: a conta do piloto). Exige contexto de tenant.
 *
 * A entrada de novos leads é a primeira etapa da ordem atual: o admin pode
 * renomear "Novo" ou reordenar o funil sem deixar a captura presa a um nome.
 */
export async function ensureDefaultPipeline(): Promise<DefaultPipeline> {
  const db = tenantDb();
  const accountId = requireTenantContext().accountId;

  const pipeline = await db.pipeline.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!pipeline) return seedPipeline(db, accountId);

  let stages = await db.stage.findMany({
    where: { pipelineId: pipeline.id },
    orderBy: { position: "asc" },
    select: { id: true, name: true, position: true, probability: true },
  });
  if (stages.length === 0) stages = await seedStages(db, accountId, pipeline.id);

  const newStage = stages[0];

  return { pipelineId: pipeline.id, newStage, stages };
}

/**
 * Salva nome, probabilidade e ordem das etapas do funil (RF-24).
 *
 * O array recebido É a nova ordem. A transação confere se todos os IDs ainda
 * pertencem ao funil atual (protege contra formulário velho e contra etapa de
 * outra conta) e reatribui posições 1..N. O client de tenant já restringe as
 * escritas à conta; a checagem de conjunto evita salvar uma ordem parcial.
 */
export async function updatePipelineStages(input: PipelineStageUpdate[]): Promise<StageRef[]> {
  const db = tenantDb();
  const { pipelineId } = await ensureDefaultPipeline();

  if (input.length === 0) {
    throw new AppError("PIPELINE_STAGES_INVALID", "Mantenha pelo menos uma etapa no funil.");
  }

  const stages = input.map((stage) => ({
    id: stage.id.trim(),
    name: stage.name.trim(),
    probability: stage.probability,
  }));

  const ids = new Set<string>();
  const names = new Set<string>();

  stages.forEach((stage, index) => {
    if (!stage.id) {
      throw new AppError("PIPELINE_STAGE_INVALID", "Etapa inválida.");
    }
    if (
      stage.name.length < PIPELINE_STAGE_NAME_MIN ||
      stage.name.length > PIPELINE_STAGE_NAME_MAX
    ) {
      throw new AppError(
        "PIPELINE_STAGE_INVALID",
        `O nome da etapa ${index + 1} precisa ter entre ${PIPELINE_STAGE_NAME_MIN} e ${PIPELINE_STAGE_NAME_MAX} caracteres.`,
      );
    }
    if (
      !Number.isInteger(stage.probability) ||
      stage.probability < PIPELINE_STAGE_PROBABILITY_MIN ||
      stage.probability > PIPELINE_STAGE_PROBABILITY_MAX
    ) {
      throw new AppError(
        "PIPELINE_STAGE_INVALID",
        `A probabilidade da etapa ${index + 1} deve ser um número inteiro entre ${PIPELINE_STAGE_PROBABILITY_MIN} e ${PIPELINE_STAGE_PROBABILITY_MAX}.`,
      );
    }
    if (ids.has(stage.id)) {
      throw new AppError("PIPELINE_STAGE_DUPLICATED", "Etapa duplicada no formulário.");
    }
    ids.add(stage.id);

    const nameKey = stage.name.toLocaleLowerCase("pt-BR");
    if (names.has(nameKey)) {
      throw new AppError("PIPELINE_STAGE_NAME_TAKEN", "Já existe uma etapa com esse nome.");
    }
    names.add(nameKey);
  });

  const current = await db.stage.findMany({
    where: { pipelineId },
    select: { id: true },
  });
  const currentIds = new Set(current.map((stage) => stage.id));
  if (current.length !== stages.length || stages.some((stage) => !currentIds.has(stage.id))) {
    throw new AppError(
      "PIPELINE_STAGES_CHANGED",
      "As etapas do funil mudaram. Recarregue a página e tente novamente.",
    );
  }

  await db.$transaction(async (tx) => {
    for (const [index, stage] of stages.entries()) {
      await tx.stage.update({
        where: { id: stage.id },
        data: {
          name: stage.name,
          probability: stage.probability,
          position: index + 1,
        },
      });
    }
  });

  return stages.map((stage, index) => ({ ...stage, position: index + 1 }));
}

/**
 * Etapas do funil atual, em ordem. A 006 usa no kanban; a 011 vai usar para
 * valor/previsão por etapa.
 */
export async function getPipelineStages(): Promise<StageRef[]> {
  const { stages } = await ensureDefaultPipeline();
  return stages;
}
