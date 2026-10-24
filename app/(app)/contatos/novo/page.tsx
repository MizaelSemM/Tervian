import Link from "next/link";

import { withSession } from "@/lib/session";
import { listOwnerOptions } from "@/server/services/contacts";
import type { ActingUser } from "@/server/services/owners";

import { QuickLeadForm } from "./quick-lead-form";

export const metadata = { title: "Novo contato — Tervian" };

/**
 * Captura rápida (US-03): nome + telefone. A página é o ponto de entrada
 * "mobile-first" — abre direto no link, funciona como tela cheia no celular e
 * tem o timer de captura medido a partir da renderização no servidor.
 */
export default async function NewContactPage() {
  return withSession(async (session) => {
    // `Date.now()` só depois do acesso dinâmico (sessão/headers) — exigência do
    // Cache Components: o timer de captura é por request, nunca pré-renderizado.
    const startedAt = Date.now();
    const actingUser: ActingUser = {
      id: session.user.id,
      role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
    };
    const owners = await listOwnerOptions(actingUser);

    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Link
            href="/contatos"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Contatos
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Novo lead</h1>
          <p className="text-muted-foreground">
            Só nome e telefone. O negócio na etapa “Novo” e a tarefa de primeiro contato para hoje
            são criados automaticamente.
          </p>
        </div>

        <QuickLeadForm
          owners={owners}
          canAssignOwner={session.user.role === "ADMIN"}
          defaultOwnerId={session.user.id}
          startedAt={startedAt}
        />
      </div>
    );
  });
}
