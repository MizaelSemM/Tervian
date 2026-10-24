import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { withSession } from "@/lib/session";
import { formatPhoneBR } from "@/lib/phone";
import { todayDateKeyBR } from "@/lib/utils";
import { getContact, listContacts } from "@/server/services/contacts";
import { listOwnerOptions, type ActingUser } from "@/server/services/owners";
import { getPipelineStages } from "@/server/services/pipeline";

import { DealForm } from "./deal-form";

export const metadata = { title: "Novo negócio — Tervian" };

function actingUserFromSession(session: {
  user: { id: string; role?: "ADMIN" | "SELLER" | null };
}): ActingUser {
  return {
    id: session.user.id,
    role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
  };
}

/**
 * Criação de negócio a partir de um contato.
 *
 * Sem `contactId`, mostra uma busca de contatos (não carregamos milhares de
 * opções num `<select>`); com `contactId`, mostra o formulário já vinculado.
 * O caminho mais comum é o botão "Novo negócio" no detalhe do contato.
 */
export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ contactId?: string; q?: string }>;
}) {
  const { contactId = "", q = "" } = await searchParams;

  return withSession(async (session) => {
    const actingUser = actingUserFromSession(session);

    if (contactId) {
      const contact = await getContact({ id: contactId, actingUser });
      if (!contact) notFound();

      const [stages, owners] = await Promise.all([
        getPipelineStages(),
        listOwnerOptions(actingUser),
      ]);
      const ownerOptions =
        contact.owner && !owners.some((owner) => owner.id === contact.owner?.id)
          ? [{ id: contact.owner.id, name: contact.owner.name }, ...owners]
          : owners;

      return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Link
              href={`/contatos/${contact.id}`}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              ← {contact.name}
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">Novo negócio</h1>
          </div>

          <DealForm
            contact={{
              id: contact.id,
              name: contact.name,
              phone: contact.phone,
              companyText: contact.companyText,
              ownerId: contact.owner?.id ?? null,
            }}
            stages={stages}
            owners={ownerOptions}
            canAssignOwner={session.user.role === "ADMIN"}
            defaultStageId={stages[0]?.id ?? ""}
            defaultOwnerId={contact.owner?.id ?? session.user.id}
            defaultNextAction={todayDateKeyBR()}
          />
        </div>
      );
    }

    const contacts = await listContacts({ actingUser, query: q, pageSize: 8 });

    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Link
            href="/negocios"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Negócios
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Novo negócio</h1>
          <p className="text-muted-foreground">
            Escolha o contato que está negociando com você. O negócio nasce com uma próxima ação.
          </p>
        </div>

        <form action="/negocios/novo" method="get" className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar contato por nome ou telefone"
            aria-label="Buscar contato"
            className="sm:flex-1"
          />
          <button type="submit" className={buttonVariants({ variant: "outline" })}>
            Buscar
          </button>
          {q && (
            <Link href="/negocios/novo" className={buttonVariants({ variant: "ghost" })}>
              Limpar
            </Link>
          )}
        </form>

        {contacts.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
            <p className="text-sm font-medium">
              {q ? "Nenhum contato encontrado." : "Nenhum contato ainda."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre o lead primeiro; o contato e o negócio podem ser criados juntos.
            </p>
            <Link
              href="/contatos/novo"
              className={buttonVariants({ variant: "outline", className: "mt-4" })}
            >
              Cadastrar lead
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl ring-1 ring-foreground/10">
            {contacts.items.map((contact) => (
              <li key={contact.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{contact.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatPhoneBR(contact.phone)}
                    {contact.companyText ? ` · ${contact.companyText}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline">
                    {contact.dealsCount} {contact.dealsCount === 1 ? "negócio" : "negócios"}
                  </Badge>
                  <Link
                    href={`/negocios/novo?contactId=${contact.id}`}
                    className={buttonVariants({ size: "sm" })}
                  >
                    Criar negócio
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  });
}
