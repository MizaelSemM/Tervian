import type { ReactNode } from "react";

import { Brand } from "@/components/brand";

/**
 * Layout das telas públicas de autenticação (tarefa 003).
 *
 * No desktop, a esquerda é o momento de marca: cobalto, tipografia Archivo e o
 * “2º toque” como assinatura. A direita é só trabalho — formulário, foco e
 * espaço para respirar.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid flex-1 lg:grid-cols-[1.02fr_0.98fr]">
      <aside className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col xl:p-14">
        <Brand href="/" tone="inverted" className="relative z-10" />

        <div className="relative z-10 mt-auto max-w-lg pb-4">
          <p className="mb-5 text-sm font-medium text-primary-foreground/70">
            CRM de follow-up para equipes de vendas
          </p>
          <p className="text-[44px] leading-[1.02] font-semibold tracking-[-0.04em] text-balance xl:text-[52px]">
            Quem chamar hoje, sem adivinhar.
          </p>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-primary-foreground/75">
            O Tervian organiza seus follow-ups por data e transforma cada conversa em próximo passo.
          </p>
        </div>

        <div
          aria-hidden
          className="font-brand pointer-events-none absolute -right-8 -bottom-24 selection:bg-transparent"
        >
          <span className="block text-[260px] leading-none font-bold text-primary-foreground/[0.07] xl:text-[320px]">
            2º
          </span>
        </div>
      </aside>

      <main className="flex flex-1 flex-col px-5 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center lg:my-auto lg:flex-none">
          <Brand className="mb-9 lg:hidden" />
          {children}
          <p className="mt-10 text-xs text-muted-foreground lg:hidden">
            CRM de follow-up para pequenas equipes de vendas
          </p>
        </div>
      </main>
    </div>
  );
}
