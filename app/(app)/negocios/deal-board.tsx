"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarClockIcon, GripVerticalIcon } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  cn,
  daysSinceBR,
  formatCurrencyBR,
  formatDateBR,
  nextActionLabelBR,
  type NextActionTone,
} from "@/lib/utils";

import { moveDealAction } from "./actions";

export type BoardDeal = {
  id: string;
  title: string;
  value: number | null;
  stageId: string;
  contact: { id: string; name: string; phone: string };
  owner: { id: string; name: string };
  expectedCloseAt: Date | null;
  nextActionAt: Date | null;
  lastActivityAt: Date | null;
  createdAt: Date;
};

export type BoardStage = {
  id: string;
  name: string;
  position: number;
  probability: number;
  count: number;
  totalValue: number;
  deals: BoardDeal[];
  hasMore: boolean;
};

type Move = { dealId: string; fromStageId: string; toStageId: string };

/**
 * Move a card entre colunas sem tocar no servidor. É um reducer puro: o
 * `useOptimistic` usa esta função e, ao fim da transição, volta para os dados
 * reais (que chegam revalidados pela Server Action).
 */
function moveCard(stages: BoardStage[], move: Move): BoardStage[] {
  if (move.fromStageId === move.toStageId) return stages;

  const source = stages.find((stage) => stage.id === move.fromStageId);
  const deal = source?.deals.find((item) => item.id === move.dealId);
  if (!source || !deal) return stages;

  const value = deal.value ?? 0;

  return stages.map((stage) => {
    if (stage.id === move.fromStageId) {
      return {
        ...stage,
        count: Math.max(0, stage.count - 1),
        totalValue: Math.max(0, stage.totalValue - value),
        deals: stage.deals.filter((item) => item.id !== move.dealId),
      };
    }
    if (stage.id === move.toStageId) {
      return {
        ...stage,
        count: stage.count + 1,
        totalValue: stage.totalValue + value,
        deals: [{ ...deal, stageId: stage.id }, ...stage.deals],
      };
    }
    return stage;
  });
}

const NEXT_ACTION_CLASSES: Record<NextActionTone, string> = {
  overdue: "bg-destructive/10 text-destructive",
  today: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  soon: "bg-muted text-muted-foreground",
  none: "bg-destructive/10 text-destructive",
};

/** Kanban com drag-and-drop entre etapas (RF-21). */
export function DealBoard({ stages }: { stages: BoardStage[] }) {
  const [optimisticStages, applyMove] = useOptimistic(stages, moveCard);
  const [activeDeal, setActiveDeal] = useState<BoardDeal | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const deal = optimisticStages.flatMap((stage) => stage.deals).find((item) => item.id === id);
    setActiveDeal(deal ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDeal(null);

    const dealId = String(event.active.id);
    const toStageId = event.over ? String(event.over.id) : null;
    if (!toStageId) return;

    const fromStage = optimisticStages.find((stage) =>
      stage.deals.some((deal) => deal.id === dealId),
    );
    const toStage = optimisticStages.find((stage) => stage.id === toStageId);
    if (!fromStage || !toStage || fromStage.id === toStage.id) return;

    startTransition(async () => {
      applyMove({ dealId, fromStageId: fromStage.id, toStageId });
      const result = await moveDealAction(dealId, toStageId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Negócio movido para “${toStage.name}”.`);
    });
  }

  return (
    <DndContext
      id="deal-board"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDeal(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {optimisticStages.map((stage) => (
          <StageColumn key={stage.id} stage={stage} />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDeal ? (
          <div className="w-72 rounded-lg border border-border bg-background p-3 shadow-lg">
            <DealCardContent deal={activeDeal} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function StageColumn({ stage }: { stage: BoardStage }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30 transition-shadow",
        isOver && "ring-2 ring-primary/50",
      )}
    >
      <header className="flex flex-col gap-0.5 border-b border-border px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-sm font-semibold">{stage.name}</h2>
          <Badge variant="secondary">{stage.count}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{formatCurrencyBR(stage.totalValue)}</p>
      </header>

      <div className="flex flex-1 flex-col gap-2 p-2">
        {stage.deals.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Nenhum negócio nesta etapa.
          </p>
        ) : (
          stage.deals.map((deal) => <DraggableCard key={deal.id} deal={deal} />)
        )}

        {stage.hasMore && (
          <Link
            href={`/negocios?view=lista&etapa=${stage.id}`}
            className={buttonVariants({ variant: "ghost", size: "sm", className: "w-full" })}
          >
            Ver todos ({stage.count})
          </Link>
        )}
      </div>
    </section>
  );
}

function DraggableCard({ deal }: { deal: BoardDeal }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });

  return (
    <article
      ref={setNodeRef}
      className={cn(
        "rounded-lg border border-border bg-background p-3 shadow-xs transition-opacity",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/negocios/${deal.id}`}
          className="min-w-0 flex-1 text-sm font-medium hover:underline"
        >
          {deal.title}
        </Link>
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Arrastar ${deal.title}`}
          className="touch-none rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <GripVerticalIcon className="size-4" />
        </button>
      </div>

      <DealCardContent deal={deal} />
    </article>
  );
}

function DealCardContent({ deal }: { deal: BoardDeal }) {
  const nextAction = nextActionLabelBR(deal.nextActionAt);
  const idleDays = daysSinceBR(deal.lastActivityAt ?? deal.createdAt);

  return (
    <div className="flex flex-col gap-2">
      <p className="truncate text-xs text-muted-foreground">
        {deal.contact.name} · {deal.owner.name}
      </p>

      <p className="text-sm font-semibold">{formatCurrencyBR(deal.value)}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        {deal.expectedCloseAt && (
          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            Prev. {formatDateBR(deal.expectedCloseAt)}
          </span>
        )}

        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
            NEXT_ACTION_CLASSES[nextAction.tone],
          )}
        >
          <CalendarClockIcon className="size-3" />
          {nextAction.text}
        </span>

        {idleDays !== null && (
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium",
              idleDays >= 7
                ? "bg-destructive/10 text-destructive"
                : idleDays >= 3
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {idleDays === 0 ? "Ativo hoje" : `${idleDays}d sem atividade`}
          </span>
        )}
      </div>
    </div>
  );
}
