import Link from "next/link";
import type { ReactNode } from "react";

/** Layout das telas públicas de autenticação (tarefa 003): cartão centralizado. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <Link href="/" className="text-2xl font-semibold tracking-tight">
        Tervian
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        CRM de follow-up para pequenas equipes de vendas
      </p>
    </div>
  );
}
