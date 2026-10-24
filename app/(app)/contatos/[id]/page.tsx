import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPhoneBR, whatsappLinkBR } from "@/lib/phone";
import { CONTACT_ORIGIN_LABELS, type ContactOrigin } from "@/lib/schemas/contact";
import { withSession, type AuthedSession } from "@/lib/session";
import { formatCurrencyBR, formatDateBR } from "@/lib/utils";
import { getContact, listOwnerOptions } from "@/server/services/contacts";
import type { ActingUser } from "@/server/services/owners";

import { ContactPanel } from "./contact-panel";

export const metadata = { title: "Contato — Tervian" };

function actingUserFrom(session: AuthedSession): ActingUser {
  return {
    id: session.user.id,
    role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
  };
}

const DEAL_STATUS_LABELS = { OPEN: "Aberto", WON: "Ganho", LOST: "Perdido" } as const;

/**
 * Detalhe do contato (005): WhatsApp/ligar, edição, exclusão lógica e os
 * negócios da pessoa. A linha do tempo e as notas chegam na 008.
 */
export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ novo?: string; salvo?: string }>;
}) {
  const { id } = await params;
  const { novo, salvo } = await searchParams;

  return withSession(async (session) => {
    const actingUser = actingUserFrom(session);
    const contact = await getContact({ id, actingUser });
    if (!contact) notFound();

    const owners = await listOwnerOptions(actingUser);
    const whatsapp = whatsappLinkBR(contact.phone);
    const originLabel = contact.origin
      ? CONTACT_ORIGIN_LABELS[contact.origin as ContactOrigin]
      : null;

    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <Link
              href="/contatos"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Contatos
            </Link>
            <h1 className="truncate text-2xl font-semibold tracking-tight">{contact.name}</h1>
            <p className="text-sm text-muted-foreground">
              {formatPhoneBR(contact.phone)}
              {contact.companyText ? ` · ${contact.companyText}` : ""}
              {contact.owner ? ` · ${contact.owner.name}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {originLabel && <Badge variant="outline">{originLabel}</Badge>}
              <Badge variant="secondary">
                {contact.deals.length} {contact.deals.length === 1 ? "negócio" : "negócios"}
              </Badge>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ size: "lg" })}
              >
                Abrir no WhatsApp
              </a>
            )}
            <a
              href={`tel:${contact.phone}`}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Ligar
            </a>
          </div>
        </div>

        {novo && (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Lead criado! O negócio está na etapa “Novo” e a tarefa “Primeiro contato” ficou para
            hoje.
          </p>
        )}
        {salvo && (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Contato atualizado.
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <ContactPanel
            contact={{
              id: contact.id,
              name: contact.name,
              phone: contact.phone,
              email: contact.email,
              companyText: contact.companyText,
              origin: contact.origin,
              ownerId: contact.owner?.id ?? null,
              ownerName: contact.owner?.name ?? null,
              createdAt: contact.createdAt,
            }}
            owners={owners}
            canAssignOwner={session.user.role === "ADMIN"}
          />

          <Card>
            <CardHeader>
              <CardTitle>Negócios</CardTitle>
              <CardDescription>
                Tudo que está (ou já foi) negociado com esta pessoa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {contact.deals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum negócio ainda. Novos leads criam um negócio automaticamente.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {contact.deals.map((deal) => (
                    <li key={deal.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-medium">{deal.title}</p>
                        <Badge
                          variant={deal.status === "OPEN" ? "secondary" : "outline"}
                          className={
                            deal.status === "WON"
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : deal.status === "LOST"
                                ? "text-muted-foreground"
                                : undefined
                          }
                        >
                          {DEAL_STATUS_LABELS[deal.status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {deal.stageName}
                        {deal.value !== null ? ` · ${formatCurrencyBR(deal.value)}` : ""}
                        {deal.nextActionAt
                          ? ` · próxima ação ${formatDateBR(deal.nextActionAt)}`
                          : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  });
}
