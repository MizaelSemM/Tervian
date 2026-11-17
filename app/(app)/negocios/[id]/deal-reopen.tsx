"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { reopenDealAction, type DealFormState } from "../actions";

/**
 * Reabertura de negócio fechado (RF-25).
 *
 * A forma fica escondida atrás de um botão para não competir com o resumo do
 * fechamento. Reabrir exige uma nova próxima ação — a mesma invariante do 007.
 */
export function DealReopen({
  dealId,
  defaultNextActionDate,
}: {
  dealId: string;
  defaultNextActionDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<DealFormState, FormData>(reopenDealAction, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reabrir negócio</CardTitle>
        <CardDescription>
          Voltou ao funil por engano ou o cliente retomou a conversa? Reabra com uma nova próxima
          ação. O histórico anterior fica preservado.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!open ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            Reabrir negócio
          </Button>
        ) : (
          <form
            action={action}
            className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3"
          >
            <input type="hidden" name="id" value={dealId} />

            <div className="flex flex-col gap-2">
              <Label htmlFor="deal-reopen-next-action">Próxima ação</Label>
              <Input
                id="deal-reopen-next-action"
                name="nextActionAt"
                type="date"
                defaultValue={defaultNextActionDate}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                O negócio só volta para o funil com uma tarefa agendada.
              </p>
            </div>

            {state?.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Reabrindo…" : "Confirmar reabertura"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
