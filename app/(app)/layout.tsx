import Link from "next/link";
import type { ReactNode } from "react";

import { requireAuth } from "@/lib/session";

import { SignOutButton } from "./sign-out-button";

/**
 * Área logada (tarefa 003).
 *
 * `instant = false`: as rotas daqui bloqueiam no servidor e renderizam já com a
 * sessão resolvida (opt-out documentado do Cache Components — ver
 * `instant.md`). Decisão consciente para o MVP; streaming com Suspense fica
 * para a tarefa de performance (016).
 */
export const instant = false;

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireAuth();
  const roleLabel = session.user.role === "ADMIN" ? "Administrador(a)" : "Vendedor(a)";
  const firstName = session.user.name.trim().split(/\s+/)[0] || session.user.name;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Tervian
          </Link>
          <Link
            href="/hoje"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Hoje
          </Link>
          <Link
            href="/negocios"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Negócios
          </Link>
          <Link
            href="/contatos"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Contatos
          </Link>
          {session.user.role === "ADMIN" && (
            <Link
              href="/equipe"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Equipe
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium">{firstName}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col p-4 sm:p-6">{children}</main>
    </div>
  );
}
