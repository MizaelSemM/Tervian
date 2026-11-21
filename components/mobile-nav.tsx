"use client";

import { BarChart3Icon, CalendarCheck2Icon, KanbanSquareIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";

const ITEMS = [
  { href: "/hoje", label: "Hoje", icon: CalendarCheck2Icon },
  { href: "/negocios", label: "Funil", icon: KanbanSquareIcon },
  { href: "/contatos", label: "Contatos", icon: UsersIcon },
] as const;

/**
 * Navegação inferior do celular (tarefa 012): alvos de 64px, ícone + rótulo e
 * alcance do polegar. O traço cobalto no topo marca a aba ativa.
 */
export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin
    ? [...ITEMS, { href: "/painel", label: "Painel", icon: BarChart3Icon }]
    : ITEMS;

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className={cn("grid", isAdmin ? "grid-cols-4" : "grid-cols-3")}>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 bg-primary" />
                )}
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
