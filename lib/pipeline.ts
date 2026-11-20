/**
 * Limites das etapas do funil editáveis em Configurações (RF-24).
 *
 * Ficam fora do schema Zod para o formulário reutilizar os mesmos limites sem
 * depender do runtime de validação no client.
 */

export const PIPELINE_STAGE_NAME_MIN = 2;
export const PIPELINE_STAGE_NAME_MAX = 60;
export const PIPELINE_STAGE_PROBABILITY_MIN = 0;
export const PIPELINE_STAGE_PROBABILITY_MAX = 100;

export type PipelineStageUpdate = {
  id: string;
  name: string;
  probability: number;
};
