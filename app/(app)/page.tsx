import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/session";

export default async function HomePage() {
  const session = await requireAuth();
  const firstName = session.user.name.trim().split(/\s+/)[0] || session.user.name;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {firstName}</h1>
        <p className="text-muted-foreground">Este é o painel da sua equipe no Tervian.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cadastre um lead em 20 segundos</CardTitle>
          <CardDescription>
            Só nome e telefone. O contato, o negócio na etapa “Novo” e a tarefa de primeiro contato
            para hoje são criados automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/contatos/novo" className={buttonVariants()}>
            Cadastrar lead
          </Link>
          <Link href="/contatos" className={buttonVariants({ variant: "outline" })}>
            Ver contatos
          </Link>
          <Link href="/negocios" className={buttonVariants({ variant: "outline" })}>
            Ver funil
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Em breve</CardTitle>
          <CardDescription>
            Tela “Hoje” com quem chamar e por quê, follow-up automático por etapa e busca na linha
            do tempo.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
