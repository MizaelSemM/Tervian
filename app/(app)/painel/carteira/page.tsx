import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { withAdmin, type AuthedSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { listPortfolio } from "@/server/services/dashboard";
import type { ActingUser } from "@/server/services/owners";

import { PortfolioTable } from "./portfolio-table";

export const metadata = { title: "Carteira — Tervian" };

type CarteiraSearchParams = {
  responsavel?: string;
  pagina?: string;
};

function actingUserFrom(session: AuthedSession): ActingUser {
  return {
    id: session.user.id,
    role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
  };
}

function pageHref(ownerId: string | null, page: number): string {
  const params = new URLSearchParams();
  if (ownerId) params.set("responsavel", ownerId);
  if (page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return query ? `/painel/carteira?${query}` : "/painel/carteira";
}

export default async function CarteiraPage({
  searchParams,
}: {
  searchParams: Promise<CarteiraSearchParams>;
}) {
  const params = await searchParams;

  return withAdmin(async (session) => {
    const data = await listPortfolio({
      actingUser: actingUserFrom(session),
      ownerId: params.responsavel,
      page: Number(params.pagina) || 1,
    });

    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div>
          <Link
            href="/painel"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Painel
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Carteira</h1>
          <p className="text-sm text-muted-foreground">
            Reatribua negócios entre vendedores sem perder o histórico. Você pode filtrar por
            responsável e selecionar os negócios da página.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border p-1">
            <Link
              href={pageHref(null, 1)}
              aria-current={data.ownerFilter === null ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors",
                data.ownerFilter === null
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              Todos
            </Link>
            {data.owners.map((owner) => (
              <Link
                key={owner.id}
                href={pageHref(owner.id, 1)}
                aria-current={data.ownerFilter === owner.id ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors",
                  data.ownerFilter === owner.id
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {owner.name}
              </Link>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {data.total} {data.total === 1 ? "negócio aberto" : "negócios abertos"}
            {data.ownerFilter ? " neste responsável" : ""}
          </p>
        </div>

        <PortfolioTable items={data.items} owners={data.owners} />

        {data.totalPages > 1 && (
          <nav
            className="flex items-center justify-between gap-3"
            aria-label="Paginação da carteira"
          >
            {data.page > 1 ? (
              <Link
                href={pageHref(data.ownerFilter, data.page - 1)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                ← Anterior
              </Link>
            ) : (
              <span />
            )}
            <p className="text-sm text-muted-foreground">
              Página {data.page} de {data.totalPages}
            </p>
            {data.page < data.totalPages ? (
              <Link
                href={pageHref(data.ownerFilter, data.page + 1)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Próxima →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}

        <Card size="sm">
          <CardContent>
            <p className="text-sm text-muted-foreground">
              <strong className="font-medium text-foreground">Histórico preservado.</strong> A troca
              não apaga eventos antigos: cada negócio recebe um evento “responsável alterado” com
              quem executou a mudança. A reatribuição também não conta como atividade do cliente,
              então negócios parados continuam aparecendo no painel.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  });
}
