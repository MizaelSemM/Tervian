import type { ReactNode } from "react";

import { AppNav } from "@/components/app-nav";
import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/mobile-nav";
import { trackEvent } from "@/lib/analytics";
import { requireAuth } from "@/lib/session";
import { runWithTenant } from "@/lib/tenant-context";

import { SignOutButton } from "./sign-out-button";
import { GlobalSearch } from "./global-search";

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
  const accountId = session.user.accountId;
  const roleLabel = session.user.role === "ADMIN" ? "Administrador(a)" : "Vendedor(a)";
  const nameParts = session.user.name.trim().split(/\s+/);
  const firstName = nameParts[0] || session.user.name;
  const initials =
    `${nameParts[0]?.[0] ?? ""}${nameParts.length > 1 ? (nameParts[nameParts.length - 1]?.[0] ?? "") : ""}`
      .toUpperCase()
      .slice(0, 2);

  if (accountId) {
    // Evento de abertura do app (métrica de vendedores ativos). O contexto de
    // tenant aqui é só para o analytics carregar account_id/role.
    runWithTenant(
      {
        accountId,
        userId: session.user.id,
        role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
      },
      () => trackEvent("user_opened_app"),
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-background px-4 sm:px-6">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-6">
            <Brand className="shrink-0" />
            <AppNav isAdmin={session.user.role === "ADMIN"} />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <GlobalSearch />
            <div className="hidden items-center gap-2.5 sm:flex">
              <span
                aria-hidden
                className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
              >
                {initials}
              </span>
              <div className="text-right leading-tight">
                <p className="text-sm font-medium">{firstName}</p>
                <p className="text-xs text-muted-foreground">{roleLabel}</p>
              </div>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-8">
        {children}
      </main>
      <MobileNav isAdmin={session.user.role === "ADMIN"} />
    </div>
  );
}
