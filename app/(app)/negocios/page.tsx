import Link from "next/link";
import { headers } from "next/headers";

import { buttonVariants } from "@/components/ui/button";
import type { DealStatusValue } from "@/lib/schemas/deal";
import { withSession } from "@/lib/session";
import { cn, formatCurrencyBR } from "@/lib/utils";
import { listDealBoard, listDeals, type DealBoard } from "@/server/services/deals";
import { listOwnerOptions, type ActingUser } from "@/server/services/owners";
import { getPipelineStages, type StageRef } from "@/server/services/pipeline";

import { DealBoard as DealBoardView } from "./deal-board";
import { DealList } from "./deal-list";

export const metadata = { title: "Negócios — Tervian" };

type NegociosSearchParams = {
  view?: string;
  q?: string;
  page?: string;
  status?: string;
  etapa?: string;
  responsavel?: string;
  novo?: string;
  salvo?: string;
  fechado?: string;
};

const STATUS_VALUES: Array<DealStatusValue | "ALL"> = ["OPEN", "WON", "LOST", "ALL"];

function actingUserFromSession(session: {
  user: { id: string; role?: "ADMIN" | "SELLER" | null };
}): ActingUser {
  return {
    id: session.user.id,
    role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
  };
}

function viewHref(
  view: "kanban" | "lista",
  filters: {
    query: string;
    status: DealStatusValue | "ALL";
    stageId: string;
    ownerId: string;
  },
): string {
  const params = new URLSearchParams({ view });
  if (filters.query) params.set("q", filters.query);
  if (filters.status !== "OPEN") params.set("status", filters.status);
  if (filters.stageId) params.set("etapa", filters.stageId);
  if (filters.ownerId) params.set("responsavel", filters.ownerId);
  return `/negocios?${params.toString()}`;
}

/**
 * Funil de negócios (RF-20..RF-23).
 *
 * O padrão depende do dispositivo: desktop vê o kanban, celular vê a lista.
 * `?view=kanban|lista` vale em qualquer tela (e é preservado nos filtros).
 * A escolha no servidor evita buscar board + lista só para esconder um deles.
 */
export default async function NegociosPage({
  searchParams,
}: {
  searchParams: Promise<NegociosSearchParams>;
}) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") ?? "";
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
  const rawView =
    params.view === "kanban" || params.view === "lista"
      ? params.view
      : isMobile
        ? "lista"
        : "kanban";
  const showKanban = rawView === "kanban";
  const showList = rawView === "lista";

  const query = params.q?.trim() ?? "";
  const rawStatus = params.status?.toUpperCase();
  const status: DealStatusValue | "ALL" =
    rawStatus && STATUS_VALUES.includes(rawStatus as DealStatusValue | "ALL")
      ? (rawStatus as DealStatusValue | "ALL")
      : "OPEN";
  const stageId = params.etapa ?? "";
  const ownerId = params.responsavel ?? "";
  const page = Number(params.page) || 1;

  return withSession(async (session) => {
    const actingUser = actingUserFromSession(session);
    const owners = await listOwnerOptions(actingUser);
    const canFilterOwner = session.user.role === "ADMIN";

    let board: DealBoard | null = null;
    let list: Awaited<ReturnType<typeof listDeals>> | null = null;
    let stages: StageRef[] = [];

    if (showKanban) {
      board = await listDealBoard({ actingUser, ownerId: ownerId || undefined });
      stages = board.stages;
    } else {
      [list, stages] = await Promise.all([
        listDeals({
          actingUser,
          query,
          status,
          stageId: stageId || undefined,
          ownerId: ownerId || undefined,
          page,
        }),
        getPipelineStages(),
      ]);
    }

    const filters = { query, status, stageId, ownerId };
    const totalOpen = board?.totalOpen ?? 0;
    const totalValue = board?.totalValue ?? 0;

    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Negócios</h1>
            <p className="text-muted-foreground">
              Seu funil do primeiro contato ao fechamento — arraste no kanban ou use a lista.
            </p>
          </div>
          <Link href="/negocios/novo" className={buttonVariants({ size: "lg" })}>
            Novo negócio
          </Link>
        </div>

        {(params.novo || params.salvo || params.fechado) && (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            {params.novo && "Negócio criado! A próxima ação já está agendada."}
            {params.salvo && "Negócio atualizado."}
            {params.fechado === "won" && "Negócio marcado como ganho. 🎉"}
            {params.fechado === "lost" && "Negócio marcado como perdido."}
            {params.fechado && " Os dados saíram do funil e ficaram no histórico."}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {board ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{totalOpen}</span>{" "}
              {totalOpen === 1 ? "negócio aberto" : "negócios abertos"} ·{" "}
              <span className="font-medium text-foreground">{formatCurrencyBR(totalValue)}</span> no
              funil
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {list?.total ?? 0} {list?.total === 1 ? "negócio" : "negócios"}
            </p>
          )}

          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <Link
              href={viewHref("kanban", filters)}
              aria-current={rawView === "kanban" ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                rawView === "kanban"
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              Kanban
            </Link>
            <Link
              href={viewHref("lista", filters)}
              aria-current={rawView === "lista" ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                rawView === "lista"
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              Lista
            </Link>
          </div>
        </div>

        {board && totalOpen === 0 && (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm font-medium">Nenhum negócio aberto no funil.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre um lead em segundos — o negócio na etapa “Novo” e a primeira ação são criados
              juntos.
            </p>
            <Link
              href="/contatos/novo"
              className={buttonVariants({ variant: "outline", className: "mt-4" })}
            >
              Cadastrar lead
            </Link>
          </div>
        )}

        {showKanban && board && <DealBoardView stages={board.stages} />}

        {showList && list && (
          <DealList
            items={list.items}
            stages={stages}
            owners={owners}
            canFilterOwner={canFilterOwner}
            filters={filters}
            total={list.total}
            page={list.page}
            totalPages={list.totalPages}
          />
        )}
      </div>
    );
  });
}
