"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PIPELINE_STAGE_NAME_MAX,
  PIPELINE_STAGE_PROBABILITY_MAX,
  PIPELINE_STAGE_PROBABILITY_MIN,
} from "@/lib/pipeline";
import type { StageRef } from "@/server/services/pipeline";

import { updatePipelineStagesAction, type PipelineStagesFormState } from "./pipeline-actions";

type StageDraft = {
  id: string;
  name: string;
  probability: string;
};

function toDraft(stages: StageRef[]): StageDraft[] {
  return stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    probability: String(stage.probability),
  }));
}

/**
 * Edição das etapas do funil (RF-24). A ordem do array é a ordem do funil: os
 * botões de seta reordenam localmente e o formulário envia as listas já na
 * ordem final. A primeira etapa é a entrada de novos leads.
 */
export function PipelineStagesSettings({ stages }: { stages: StageRef[] }) {
  const [drafts, setDrafts] = useState<StageDraft[]>(() => toDraft(stages));

  const [state, formAction, pending] = useActionState<PipelineStagesFormState, FormData>(
    async (previous, formData) => {
      const result = await updatePipelineStagesAction(previous, formData);
      if (result?.stages) setDrafts(toDraft(result.stages));
      return result;
    },
    null,
  );

  function updateStage(id: string, patch: Partial<Omit<StageDraft, "id">>) {
    setDrafts((current) =>
      current.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage)),
    );
  }

  function moveStage(index: number, direction: -1 | 1) {
    setDrafts((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;

      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (!moved) return current;
      next.splice(target, 0, moved);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Etapas do funil</CardTitle>
        <CardDescription>
          Renomeie, mude a ordem e ajuste a probabilidade de cada etapa. Novos leads entram na
          primeira etapa, e a ordem define as colunas do funil.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <ol className="flex flex-col gap-3">
            {drafts.map((stage, index) => (
              <li
                key={stage.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3"
              >
                <input type="hidden" name="stageId" value={stage.id} />

                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Etapa {index + 1}</p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => moveStage(index, -1)}
                      disabled={index === 0 || pending}
                      aria-label={`Mover etapa ${index + 1} para cima`}
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => moveStage(index, 1)}
                      disabled={index === drafts.length - 1 || pending}
                      aria-label={`Mover etapa ${index + 1} para baixo`}
                    >
                      <ArrowDownIcon />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor={`stage-name-${stage.id}`}>Nome</Label>
                    <Input
                      id={`stage-name-${stage.id}`}
                      name="stageName"
                      value={stage.name}
                      onChange={(event) => updateStage(stage.id, { name: event.target.value })}
                      maxLength={PIPELINE_STAGE_NAME_MAX}
                      aria-label={`Nome da etapa ${index + 1}`}
                      required
                      disabled={pending}
                    />
                  </div>

                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor={`stage-probability-${stage.id}`}>Probabilidade (%)</Label>
                    <Input
                      id={`stage-probability-${stage.id}`}
                      name="stageProbability"
                      type="number"
                      inputMode="numeric"
                      min={PIPELINE_STAGE_PROBABILITY_MIN}
                      max={PIPELINE_STAGE_PROBABILITY_MAX}
                      step={1}
                      value={stage.probability}
                      onChange={(event) =>
                        updateStage(stage.id, { probability: event.target.value })
                      }
                      aria-label={`Probabilidade da etapa ${index + 1}`}
                      required
                      disabled={pending}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <p className="text-xs text-muted-foreground">
            A probabilidade alimenta a previsão ponderada do painel do gestor (valor ×
            probabilidade).
          </p>

          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state?.success && (
            <p role="status" className="text-sm text-success">
              {state.success}
            </p>
          )}

          <Button type="submit" size="sm" className="self-start" disabled={pending}>
            {pending ? "Salvando…" : "Salvar etapas"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
