"use client";

import { BarChart3Icon, CalendarCheck2Icon, KanbanSquareIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/hoje", label: "Hoje", icon: CalendarCheck2Icon },
  { href: "/negocios", label: "Funil", icon: KanbanSquareIcon },
  { href: "/contatos", label: "Contatos", icon: UsersIcon },
] as const;

/**
 * Navegação inferior do celular (tarefa 012): alvos de 56px, ícone + rótulo e
 * alcance do polegar. No desktop o menu do cabeçalho continua igual.
 */
export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin
    ? [...ITEMS, { href: "/painel", label: "Painel", icon: BarChart3Icon }]
    : ITEMS;

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
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
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "text-primary")} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
