import Link from "next/link";

import { PRIVACY_PATH, TERMS_VERSION } from "@/lib/lgpd";

export const metadata = {
  title: "Termos de uso — Tervian",
  description: "Termos de uso do Tervian, CRM de follow-up para pequenas equipes de vendas.",
};

/** Termos de uso (tarefa 013) — critério de lançamento do piloto. */
export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Termos de uso</h1>
      <p className="mt-1 text-sm text-muted-foreground">Versão {TERMS_VERSION}</p>

      <div className="mt-6 flex flex-col gap-6 text-sm leading-relaxed">
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">1. O serviço</h2>
          <p>
            O Tervian é um CRM de follow-up para pequenas equipes de vendas. Ele organiza contatos,
            negócios e a próxima ação de cada oportunidade. O serviço é fornecido no modelo SaaS,
            com plano gratuito e planos pagos que podem ser contratados à parte.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">2. Conta e responsabilidades</h2>
          <p>
            Ao criar a conta, você declara ter poderes para representar a empresa contratante. Cada
            usuário é responsável por manter a senha em sigilo e por orientar a equipe sobre o uso
            adequado da ferramenta. O administrador da conta controla convites, papéis e
            desativações.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">3. Uso aceitável</h2>
          <p>
            É proibido usar o Tervian para enviar spam, armazenar dados obtidos sem base legal,
            tentar acessar dados de outras contas ou comprometer a segurança do serviço. A
            importação de contatos exige declaração de base legal (LGPD) no momento do envio.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">4. Dados e privacidade</h2>
          <p>
            O tratamento de dados pessoais segue a{" "}
            <Link href={PRIVACY_PATH} className="underline underline-offset-4">
              Política de Privacidade
            </Link>
            . A empresa contratante é a controladora dos dados dos seus contatos; a Tervian atua
            como operadora e trata os dados apenas para prestar o serviço.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">5. Disponibilidade e suporte</h2>
          <p>
            Buscamos disponibilidade de 99,5% ao mês, mas o serviço pode passar por manutenções
            programadas. O suporte é feito pelos canais informados na contratação.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">6. Encerramento</h2>
          <p>
            Você pode encerrar a conta a qualquer momento. Após o encerramento, os dados ficam
            disponíveis para exportação por 30 dias e depois são eliminados, salvo obrigação legal
            de retenção.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">7. Alterações</h2>
          <p>
            Podemos atualizar estes termos para refletir mudanças no serviço ou na legislação. A
            versão vigente é sempre exibida nesta página e o aceite fica registrado na conta.
          </p>
        </section>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        <Link href="/cadastro" className="underline underline-offset-4">
          Voltar ao cadastro
        </Link>
      </p>
    </main>
  );
}
