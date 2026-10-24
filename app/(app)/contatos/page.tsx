import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CONTACT_ORIGIN_LABELS, type ContactOrigin } from "@/lib/schemas/contact";
import { withSession } from "@/lib/session";
import { formatPhoneBR, whatsappLinkBR } from "@/lib/phone";
import { listContacts } from "@/server/services/contacts";

import type { ActingUser } from "@/server/services/owners";

export const metadata = { title: "Contatos — Tervian" };

type ContactsSearchParams = {
  q?: string;
  page?: string;
  novo?: string;
  salvo?: string;
  excluido?: string;
};

function actingUserFromSession(session: {
  user: { id: string; role?: "ADMIN" | "SELLER" | null };
}): ActingUser {
  return {
    id: session.user.id,
    role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
  };
}

function pageHref(page: number, query: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/contatos?${suffix}` : "/contatos";
}

/**
 * Lista de contatos com busca por nome/telefone e paginação (RF-10/014).
 * Busca e página vivem na URL (form GET) — funciona sem JavaScript e é
 * compatível com o botão voltar do celular.
 */
export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<ContactsSearchParams>;
}) {
  const { q = "", page: pageParam, novo, salvo, excluido } = await searchParams;

  return withSession(async (session) => {
    const actingUser = actingUserFromSession(session);
    const result = await listContacts({
      actingUser,
      query: q,
      page: Number(pageParam) || 1,
    });

    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Contatos</h1>
            <p className="text-muted-foreground">
              Quem você atende, com WhatsApp e telefone a um toque.
            </p>
          </div>
          <Link href="/contatos/novo" className={buttonVariants({ size: "lg" })}>
            Novo contato
          </Link>
        </div>

        {novo && (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Lead criado! O negócio já está na etapa “Novo” e o primeiro contato ficou para hoje.
          </p>
        )}
        {salvo && (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Contato atualizado.
          </p>
        )}
        {excluido && (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Contato excluído. O histórico de negócios fechados foi preservado.
          </p>
        )}

        <form action="/contatos" method="get" className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome ou telefone"
            aria-label="Buscar contatos por nome ou telefone"
            className="sm:flex-1"
          />
          <div className="flex items-center gap-2">
            <button type="submit" className={buttonVariants({ variant: "outline" })}>
              Buscar
            </button>
            {q && (
              <Link href="/contatos" className={buttonVariants({ variant: "ghost" })}>
                Limpar
              </Link>
            )}
          </div>
        </form>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {q
                ? `${result.total} ${result.total === 1 ? "resultado" : "resultados"} para “${q}”`
                : `${result.total} ${result.total === 1 ? "contato" : "contatos"}`}
            </h2>
            {result.totalPages > 1 && (
              <p className="text-xs text-muted-foreground">
                Página {result.page} de {result.totalPages}
              </p>
            )}
          </div>

          {result.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm font-medium">
                {q ? "Nenhum contato encontrado." : "Nenhum contato ainda."}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {q
                  ? "Tente outro nome ou apenas os dígitos do telefone."
                  : "Cadastre um lead com nome e telefone — leva menos de 20 segundos."}
              </p>
              {!q && (
                <Link
                  href="/contatos/novo"
                  className={buttonVariants({ variant: "outline", className: "mt-4" })}
                >
                  Cadastrar primeiro lead
                </Link>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl ring-1 ring-foreground/10">
              {result.items.map((contact) => {
                const whatsapp = whatsappLinkBR(contact.phone);
                const originLabel = contact.origin
                  ? CONTACT_ORIGIN_LABELS[contact.origin as ContactOrigin]
                  : null;

                return (
                  <li
                    key={contact.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/contatos/${contact.id}`}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {contact.name}
                        </Link>
                        {originLabel && <Badge variant="outline">{originLabel}</Badge>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatPhoneBR(contact.phone)}
                        {contact.companyText ? ` · ${contact.companyText}` : ""}
                        {contact.owner ? ` · ${contact.owner.name}` : ""}
                        {` · ${contact.dealsCount} ${contact.dealsCount === 1 ? "negócio" : "negócios"}`}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {whatsapp && (
                        <a
                          href={whatsapp}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonVariants({ variant: "secondary", size: "sm" })}
                        >
                          WhatsApp
                        </a>
                      )}
                      <a
                        href={`tel:${contact.phone}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Ligar
                      </a>
                      <Link
                        href={`/contatos/${contact.id}`}
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

          {result.totalPages > 1 && (
            <nav className="flex items-center justify-between gap-3" aria-label="Paginação">
              {result.page > 1 ? (
                <Link
                  href={pageHref(result.page - 1, q)}
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
              {result.page < result.totalPages ? (
                <Link
                  href={pageHref(result.page + 1, q)}
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
      </div>
    );
  });
}
