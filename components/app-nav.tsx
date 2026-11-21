"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";

const ITEMS = [
  { href: "/hoje", label: "Hoje" },
  { href: "/negocios", label: "Negócios" },
  { href: "/contatos", label: "Contatos" },
] as const;

const ADMIN_ITEMS = [
  { href: "/painel", label: "Painel" },
  { href: "/equipe", label: "Equipe" },
  { href: "/configuracoes", label: "Configurações" },
] as const;

/** Navegação desktop com estado ativo (a versão mobile fica em MobileNav). */
export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...ITEMS, ...ADMIN_ITEMS] : ITEMS;

  return (
    <nav aria-label="Navegação do app" className="hidden items-center gap-1 md:flex">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-16 items-center px-2.5 text-sm font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-2.5 bottom-0 h-0.5 bg-primary transition-opacity",
                active ? "opacity-100" : "opacity-0",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
