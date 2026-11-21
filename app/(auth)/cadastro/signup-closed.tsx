import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Aviso exibido no lugar do formulário quando `SIGNUPS_ENABLED=false`.
 * Não há formulário nem action: cadastro está fechado, login segue aberto.
 */
export function SignUpClosed() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em]">
          Cadastros fechados
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Novas contas não estão sendo aceitas neste momento.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Já tem uma conta?</CardTitle>
          <CardDescription>
            Entre com seu e-mail e senha para continuar usando o Tervian. Quem já acessa não teve
            nenhuma mudança.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/login" className={buttonVariants({ className: "h-11 w-full" })}>
            Entrar
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
