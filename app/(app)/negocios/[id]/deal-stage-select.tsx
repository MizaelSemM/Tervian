"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { moveDealAction } from "../actions";

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** Alternativa ao drag para mudar de etapa (teclado/celular). */
export function DealStageSelect({
  dealId,
  currentStageId,
  stages,
}: {
  dealId: string;
  currentStageId: string;
  stages: Array<{ id: string; name: string }>;
}) {
  const [pending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const select = event.currentTarget;
    const toStageId = select.value;
    if (!toStageId || toStageId === currentStageId) return;

    startTransition(async () => {
      const result = await moveDealAction(dealId, toStageId);
      if (!result.ok) {
        select.value = currentStageId;
        toast.error(result.error);
        return;
      }
      toast.success("Etapa atualizada.");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="deal-stage" className="text-xs text-muted-foreground">
        Etapa do funil
      </label>
      <select
        key={currentStageId}
        id="deal-stage"
        defaultValue={currentStageId}
        onChange={handleChange}
        disabled={pending}
        className={selectClassName}
      >
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
          </option>
        ))}
      </select>
      {pending && <p className="text-xs text-muted-foreground">Movendo…</p>}
    </div>
  );
}
