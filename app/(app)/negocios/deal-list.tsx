import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPhoneBR, whatsappLinkBR } from "@/lib/phone";
import { DEAL_STATUS_LABELS, type DealStatusValue } from "@/lib/schemas/deal";
import {
  cn,
  daysSinceBR,
  formatCurrencyBR,
  formatDateBR,
  nextActionLabelBR,
  type NextActionTone,
} from "@/lib/utils";
import type { DealListItem } from "@/server/services/deals";
import type { StageRef } from "@/server/services/pipeline";

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const NEXT_ACTION_CLASSES: Record<NextActionTone, string> = {
  overdue: "text-destructive",
  today: "text-primary",
  soon: "text-muted-foreground",
  none: "text-destructive",
};

type DealListFilters = {
  query: string;
  status: DealStatusValue | "ALL";
  stageId: string;
  ownerId: string;
};

function listHref(filters: DealListFilters, page: number): string {
  const params = new URLSearchParams({ view: "lista" });
  if (filters.query) params.set("q", filters.query);
  if (filters.status !== "OPEN") params.set("status", filters.status);
  if (filters.stageId) params.set("etapa", filters.stageId);
  if (filters.ownerId) params.set("responsavel", filters.ownerId);
  if (page > 1) params.set("page", String(page));
  return `/negocios?${params.toString()}`;
}

/** Visão em lista — padrão no celular, também usada para buscar e filtrar. */
export function DealList({
  items,
  stages,
  owners,
  canFilterOwner,
  filters,
  total,
  page,
  totalPages,
}: {
  items: DealListItem[];
  stages: StageRef[];
  owners: Array<{ id: string; name: string }>;
  canFilterOwner: boolean;
  filters: DealListFilters;
  total: number;
  page: number;
  totalPages: number;
}) {
  return (
    <section className="flex flex-col gap-4">
      <form action="/negocios" method="get" className="flex flex-col gap-2">
        <input type="hidden" name="view" value="lista" />
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={filters.query}
            placeholder="Buscar negócio ou contato"
            aria-label="Buscar negócios"
            className="min-w-0 flex-1 basis-40"
          />
          <button type="submit" className={buttonVariants({ variant: "outline" })}>
            Buscar
          </button>
          {(filters.query || filters.stageId || filters.ownerId || filters.status !== "OPEN") && (
            <Link href="/negocios?view=lista" className={buttonVariants({ variant: "ghost" })}>
              Limpar
            </Link>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <select
            name="status"
            defaultValue={filters.status}
            aria-label="Filtrar por status"
            className={selectClassName}
          >
            <option value="OPEN">Abertos</option>
            <option value="WON">Ganhos</option>
            <option value="LOST">Perdidos</option>
            <option value="ALL">Todos</option>
          </select>

          <select
            name="etapa"
            defaultValue={filters.stageId}
            aria-label="Filtrar por etapa"
            className={selectClassName}
          >
            <option value="">Todas as etapas</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>

          {canFilterOwner ? (
            <select
              name="responsavel"
              defaultValue={filters.ownerId}
              aria-label="Filtrar por responsável"
              className={selectClassName}
            >
              <option value="">Toda a equipe</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          ) : (
            <div />
          )}
        </div>
      </form>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {total} {total === 1 ? "negócio" : "negócios"}
        </h2>
        {totalPages > 1 && (
          <p className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-10 text-center">
          <p className="text-sm font-medium">Nenhum negócio encontrado.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajuste os filtros ou cadastre um novo negócio a partir de um contato.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {items.map((deal) => {
            const whatsapp = whatsappLinkBR(deal.contact.phone);
            const nextAction = nextActionLabelBR(deal.nextActionAt);
            const idleDays = daysSinceBR(deal.lastActivityAt ?? deal.createdAt);

            return (
              <li
                key={deal.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/negocios/${deal.id}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {deal.title}
                    </Link>
                    <Badge variant={deal.status === "OPEN" ? "secondary" : "outline"}>
                      {DEAL_STATUS_LABELS[deal.status]}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{deal.stageName}</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {formatCurrencyBR(deal.value)}
                    </span>
                    <Link href={`/contatos/${deal.contact.id}`} className="hover:underline">
                      {deal.contact.name}
                    </Link>
                    <span>{deal.owner.name}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="tabular-nums">{formatPhoneBR(deal.contact.phone)}</span>
                    {deal.status === "OPEN" ? (
                      <>
                        <span className={NEXT_ACTION_CLASSES[nextAction.tone]}>
                          Próxima ação: {nextAction.text}
                        </span>
                        {idleDays !== null && (
                          <span
                            className={cn(
                              idleDays >= 7 ? "text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {idleDays === 0 ? "ativo hoje" : `${idleDays}d sem atividade`}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span>Fechado em {formatDateBR(deal.closedAt)}</span>
                        {deal.lostReasonName && <span>{deal.lostReasonName}</span>}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {whatsapp && deal.status === "OPEN" && (
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                    >
                      WhatsApp
                    </a>
                  )}
                  <Link
                    href={`/negocios/${deal.id}`}
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    Abrir
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Paginação">
          {page > 1 ? (
            <Link
              href={listHref(filters, page - 1)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Anterior
            </Link>
          ) : (
            <span
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "opacity-40",
              })}
            >
              Anterior
            </span>
          )}
          {page < totalPages ? (
            <Link
              href={listHref(filters, page + 1)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Próxima
            </Link>
          ) : (
            <span
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "opacity-40",
              })}
            >
              Próxima
            </span>
          )}
        </nav>
      )}
    </section>
  );
}
