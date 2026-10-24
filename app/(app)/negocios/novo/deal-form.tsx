"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhoneBR } from "@/lib/phone";
import type { StageRef } from "@/server/services/pipeline";

import { createDealAction, type DealFormState } from "../actions";

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export type DealFormContact = {
  id: string;
  name: string;
  phone: string;
  companyText: string | null;
  ownerId: string | null;
};

/** Criação de negócio para um contato existente. */
export function DealForm({
  contact,
  stages,
  owners,
  canAssignOwner,
  defaultStageId,
  defaultOwnerId,
  defaultNextAction,
}: {
  contact: DealFormContact;
  stages: StageRef[];
  owners: Array<{ id: string; name: string }>;
  canAssignOwner: boolean;
  defaultStageId: string;
  defaultOwnerId: string;
  defaultNextAction: string;
}) {
  const [state, formAction, pending] = useActionState<DealFormState, FormData>(
    createDealAction,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo negócio</CardTitle>
        <CardDescription>
          {contact.name} · {formatPhoneBR(contact.phone)}
          {contact.companyText ? ` · ${contact.companyText}` : ""}
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <input type="hidden" name="contactId" value={contact.id} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="deal-title">Título</Label>
            <Input
              id="deal-title"
              name="title"
              placeholder="Ex.: Compra de 20 unidades"
              defaultValue=""
              autoFocus
              required
              maxLength={120}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="deal-value">Valor (R$)</Label>
              <Input
                id="deal-value"
                name="value"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0,00"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="deal-stage">Etapa</Label>
              <select
                id="deal-stage"
                name="stageId"
                defaultValue={defaultStageId}
                className={selectClassName}
              >
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="deal-expected-close">Previsão de fechamento</Label>
              <Input id="deal-expected-close" name="expectedCloseAt" type="date" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="deal-next-action">Próxima ação</Label>
              <Input
                id="deal-next-action"
                name="nextActionAt"
                type="date"
                defaultValue={defaultNextAction}
                required
              />
              <p className="text-xs text-muted-foreground">
                Cria automaticamente uma tarefa de follow-up nessa data.
              </p>
            </div>
          </div>

          {canAssignOwner && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="deal-owner">Responsável</Label>
              <select
                id="deal-owner"
                name="ownerId"
                defaultValue={defaultOwnerId}
                className={selectClassName}
              >
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Criando…" : "Criar negócio"}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
