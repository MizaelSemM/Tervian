"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyBR } from "@/lib/utils";
import type { PortfolioData } from "@/server/services/dashboard";

import { reassignDealsAction, type ReassignState } from "../actions";

const selectClassName =
  "h-8 min-w-52 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * Reatribui����o em lote da carteira (US-05).
 *
 * A sele����o �� s�� da p��gina atual; o servidor revalida os ids, o dono e a
 * conta antes de trocar. O hist��rico de cada neg��cio ganha um evento novo.
 */
export function PortfolioTable({
  items,
  owners,
}: {
  items: PortfolioData["items"];
  owners: PortfolioData["owners"];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction, pending] = useActionState<ReassignState, FormData>(
    async (previous, formData) => {
      const result = await reassignDealsAction(previous, formData);
      if (result?.ok) setSelected(new Set());
      return result;
    },
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.error);
  }, [state]);

  // A revalida����o pode remover neg��cios do filtro; ids que sa��ram da p��gina
  // deixam de contar sem precisar de setState em effect.
  const selectedIds = items.filter((deal) => selected.has(deal.id)).map((deal) => deal.id);
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const someSelected = selectedIds.length > 0;

  function toggleOne(dealId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(dealId)) next.delete(dealId);
      else next.add(dealId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      if (items.every((deal) => current.has(deal.id))) return new Set();
      const next = new Set(current);
      for (const deal of items) next.add(deal.id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Neg��cios abertos</CardTitle>
        <CardDescription>
          Selecione um ou mais neg��cios e escolha o novo respons��vel. As tarefas abertas
          acompanham a troca e o hist��rico �� preservado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {selectedIds.map((dealId) => (
            <input key={dealId} type="hidden" name="dealIds" value={dealId} />
          ))}

          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
            <label htmlFor="reassign-owner" className="text-sm font-medium">
              Reatribuir selecionados para
            </label>
            <select
              id="reassign-owner"
              name="ownerId"
              required
              defaultValue=""
              className={selectClassName}
              disabled={pending}
            >
              <option value="" disabled>
                Escolha o respons��vel
              </option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" disabled={pending || selectedIds.length === 0}>
              {pending ? "Reatribuindo..." : `Reatribuir (${selectedIds.length})`}
            </Button>
            {selectedIds.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
                disabled={pending}
              >
                Limpar sele����o
              </Button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
              Nenhum neg��cio aberto neste filtro.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="w-10 pb-2">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = someSelected && !allSelected;
                        }}
                        onChange={toggleAll}
                        aria-label="Selecionar todos os neg��cios desta p��gina"
                        className="size-4 rounded border-border accent-foreground"
                      />
                    </th>
                    <th className="pb-2 font-medium">Neg��cio</th>
                    <th className="pb-2 font-medium">Etapa</th>
                    <th className="pb-2 text-right font-medium">Valor</th>
                    <th className="pb-2 font-medium">Respons��vel</th>
                    <th className="pb-2 text-right font-medium">��ltima atividade</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((deal) => {
                    const checked = selected.has(deal.id);
                    return (
                      <tr
                        key={deal.id}
                        className={
                          checked
                            ? "border-b border-border/60 bg-muted/40"
                            : "border-b border-border/60"
                        }
                      >
                        <td className="py-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOne(deal.id)}
                            aria-label={`Selecionar ${deal.title}`}
                            className="size-4 rounded border-border accent-foreground"
                          />
                        </td>
                        <td className="py-2.5">
                          <Link
                            href={`/negocios/${deal.id}`}
                            className="font-medium hover:underline"
                          >
                            {deal.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">{deal.contact.name}</p>
                        </td>
                        <td className="py-2.5">
                          <Badge variant="secondary">{deal.stageName}</Badge>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {formatCurrencyBR(deal.value)}
                        </td>
                        <td className="py-2.5">{deal.owner.name}</td>
                        <td className="py-2.5 text-right text-muted-foreground">
                          {deal.lastActivityLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
