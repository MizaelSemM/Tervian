"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dateKeyBR } from "@/lib/utils";

import { updateDealAction, type DealFormState } from "../actions";

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export type EditableDeal = {
  id: string;
  title: string;
  value: number | null;
  ownerId: string;
  expectedCloseAt: Date | null;
};

/** Edição dos campos comerciais; etapa e próxima ação têm controles próprios. */
export function DealEditForm({
  deal,
  owners,
  canAssignOwner,
}: {
  deal: EditableDeal;
  owners: Array<{ id: string; name: string }>;
  canAssignOwner: boolean;
}) {
  const [state, formAction, pending] = useActionState<DealFormState, FormData>(
    updateDealAction,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados do negócio</CardTitle>
        <CardDescription>Título, valor, responsável e previsão de fechamento.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={deal.id} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="deal-edit-title">Título</Label>
            <Input
              id="deal-edit-title"
              name="title"
              defaultValue={deal.title}
              required
              maxLength={120}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="deal-edit-value">Valor (R$)</Label>
              <Input
                id="deal-edit-value"
                name="value"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                defaultValue={deal.value ?? ""}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="deal-edit-expected-close">Previsão de fechamento</Label>
              <Input
                id="deal-edit-expected-close"
                name="expectedCloseAt"
                type="date"
                defaultValue={dateKeyBR(deal.expectedCloseAt)}
              />
            </div>
          </div>

          {canAssignOwner && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="deal-edit-owner">Responsável</Label>
              <select
                id="deal-edit-owner"
                name="ownerId"
                defaultValue={deal.ownerId}
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

          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
