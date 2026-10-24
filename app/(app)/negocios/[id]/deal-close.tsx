"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrencyBR } from "@/lib/utils";

import { closeDealAction, type DealFormState } from "../actions";

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const textareaClassName =
  "min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** Fechamento ganho/perdido. Perdido exige um dos motivos ativos da conta. */
export function DealClose({
  dealId,
  currentValue,
  lostReasons,
}: {
  dealId: string;
  currentValue: number | null;
  lostReasons: Array<{ id: string; name: string }>;
}) {
  const [mode, setMode] = useState<"WON" | "LOST" | null>(null);
  const [wonState, wonAction, wonPending] = useActionState<DealFormState, FormData>(
    closeDealAction,
    null,
  );
  const [lostState, lostAction, lostPending] = useActionState<DealFormState, FormData>(
    closeDealAction,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fechar negócio</CardTitle>
        <CardDescription>
          O resultado sai do funil, entra no histórico e cancela a próxima ação.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!mode && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" size="sm" onClick={() => setMode("WON")}>
              Marcar como ganho
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setMode("LOST")}>
              Marcar como perdido
            </Button>
          </div>
        )}

        {mode === "WON" && (
          <form
            action={wonAction}
            className="flex flex-col gap-3 rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-3"
          >
            <input type="hidden" name="id" value={dealId} />
            <input type="hidden" name="status" value="WON" />
            <p className="text-sm font-medium">Confirmar ganho</p>
            <p className="text-xs text-muted-foreground">
              Valor atual: {formatCurrencyBR(currentValue)}. Confirme o valor final abaixo.
            </p>

            <div className="flex flex-col gap-2">
              <Label htmlFor="deal-won-value">Valor final (R$)</Label>
              <Input
                id="deal-won-value"
                name="value"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                defaultValue={currentValue ?? ""}
                required={currentValue === null}
                autoFocus
              />
            </div>

            {wonState?.error && (
              <p role="alert" className="text-sm text-destructive">
                {wonState.error}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={wonPending}>
                {wonPending ? "Fechando…" : "Confirmar ganho"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={wonPending}
                onClick={() => setMode(null)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {mode === "LOST" && (
          <form
            action={lostAction}
            className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
          >
            <input type="hidden" name="id" value={dealId} />
            <input type="hidden" name="status" value="LOST" />
            <p className="text-sm font-medium">Registrar perda</p>
            <p className="text-xs text-muted-foreground">
              O motivo é obrigatório e alimenta o relatório de perdas (011).
            </p>

            <div className="flex flex-col gap-2">
              <Label htmlFor="deal-lost-reason">Motivo</Label>
              <select
                id="deal-lost-reason"
                name="lostReasonId"
                required
                defaultValue=""
                className={selectClassName}
              >
                <option value="" disabled>
                  Escolha o motivo
                </option>
                {lostReasons.map((reason) => (
                  <option key={reason.id} value={reason.id}>
                    {reason.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="deal-lost-note">Observação (opcional)</Label>
              <textarea
                id="deal-lost-note"
                name="lostNote"
                maxLength={500}
                className={textareaClassName}
                placeholder="Ex.: achou o preço alto, vai reavaliar no próximo trimestre."
              />
            </div>

            {lostState?.error && (
              <p role="alert" className="text-sm text-destructive">
                {lostState.error}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="destructive" size="sm" disabled={lostPending}>
                {lostPending ? "Fechando…" : "Confirmar perda"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={lostPending}
                onClick={() => setMode(null)}
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
