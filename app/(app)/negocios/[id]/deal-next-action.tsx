"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cn,
  dateKeyBR,
  formatDateBR,
  nextActionLabelBR,
  parseDateKeyBR,
  todayDateKeyBR,
} from "@/lib/utils";

import { deferDealAction, rescheduleDealAction } from "../actions";

/** Próxima ação do negócio: data editável + atalho "adiar 1 dia" com desfazer. */
export function DealNextAction({
  dealId,
  nextActionAt,
}: {
  dealId: string;
  nextActionAt: Date | null;
}) {
  const [pending, startTransition] = useTransition();
  const nextAction = nextActionLabelBR(nextActionAt);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = String(new FormData(event.currentTarget).get("date") ?? "");

    startTransition(async () => {
      const result = await rescheduleDealAction(dealId, date);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Próxima ação atualizada.");
    });
  }

  function handleDefer() {
    startTransition(async () => {
      const result = await deferDealAction(dealId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (!("newDate" in result)) return;

      toast.success(`Adiada para ${formatDateBR(parseDateKeyBR(result.newDate))}.`, {
        action: result.oldDate
          ? {
              label: "Desfazer",
              onClick: () => {
                startTransition(async () => {
                  const undo = await rescheduleDealAction(dealId, result.oldDate!);
                  if (!undo.ok) toast.error(undo.error);
                });
              },
            }
          : undefined,
      });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Próxima ação</CardTitle>
        <CardDescription>
          Todo negócio aberto precisa de uma data. A tarefa aparece na tela “Hoje” (007).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Agendada para</span>
            <span
              className={cn(
                "text-sm font-medium",
                nextAction.tone === "overdue" && "text-destructive",
                nextAction.tone === "none" && "text-destructive",
              )}
            >
              {nextActionAt
                ? `${formatDateBR(nextActionAt)} · ${nextAction.text}`
                : nextAction.text}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={handleDefer}
          >
            Adiar 1 dia
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="deal-next-action">Nova data</Label>
            <Input
              key={dateKeyBR(nextActionAt) || "sem-data"}
              id="deal-next-action"
              name="date"
              type="date"
              defaultValue={dateKeyBR(nextActionAt) || todayDateKeyBR()}
              required
            />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Salvando…" : "Reagendar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
