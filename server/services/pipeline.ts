import { requireTenantContext } from "@/lib/tenant-context";
import { createTenantClient, tenantDb, type TenantClient } from "@/lib/tenant-prisma";

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
 * Garante um funil com etapa "Novo" na conta atual. Usado por `createLead()`
 * para contas criadas antes da 005 (ex.: a conta do piloto). Exige contexto de
 * tenant.
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

  const newStage =
    stages.find(
      (stage) => stage.name.trim().toLowerCase() === DEFAULT_NEW_STAGE_NAME.toLowerCase(),
    ) ?? stages[0];

  return { pipelineId: pipeline.id, newStage, stages };
}

/**
 * Etapas do funil atual, em ordem. A 006 usa no kanban; a 011 vai usar para
 * valor/previsão por etapa.
 */
export async function getPipelineStages(): Promise<StageRef[]> {
  const { stages } = await ensureDefaultPipeline();
  return stages;
}
