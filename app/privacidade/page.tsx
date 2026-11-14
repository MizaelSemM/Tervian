import Link from "next/link";

import { PRIVACY_EMAIL, TERMS_PATH, TERMS_VERSION } from "@/lib/lgpd";

export const metadata = {
  title: "Política de privacidade — Tervian",
  description: "Como o Tervian trata dados pessoais, conforme a LGPD.",
};

/** Política de privacidade (tarefa 013) — critério de lançamento do piloto. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Política de privacidade</h1>
      <p className="mt-1 text-sm text-muted-foreground">Versão {TERMS_VERSION}</p>

      <div className="mt-6 flex flex-col gap-6 text-sm leading-relaxed">
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">1. Quem trata os dados</h2>
          <p>
            A empresa que contrata o Tervian é a <strong>controladora</strong> dos dados dos seus
            contatos. A Tervian atua como <strong>operadora</strong>: trata os dados apenas para
            prestar o serviço, conforme as instruções da controladora e a LGPD (Lei 13.709/2018).
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">2. Dados tratados</h2>
          <p>
            Dados de contato (nome, telefone, e-mail, empresa), dados do negócio (valor, etapa,
            próxima ação), notas e histórico de atividades. Também registramos dados de acesso
            (sessão, data/hora e endereço IP) para segurança e auditoria.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">3. Finalidade e base legal</h2>
          <p>
            Os dados são usados para organizar o follow-up comercial da própria controladora. A base
            legal é definida pela controladora (por exemplo, execução de contrato, legítimo
            interesse ou consentimento). Na importação de CSV e no cadastro, a base legal é
            declarada e registrada com data.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">4. Compartilhamento e localização</h2>
          <p>
            Usamos provedores de infraestrutura (banco de dados e hospedagem) que podem processar
            dados fora do Brasil, sempre com cláusulas contratuais de proteção. Não vendemos dados
            pessoais e não os usamos para publicidade de terceiros.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">5. Retenção</h2>
          <p>
            Os dados ficam armazenados enquanto a conta estiver ativa. Após o encerramento, ficam
            disponíveis para exportação por 30 dias e depois são eliminados, salvo obrigação legal
            de retenção. A controladora pode excluir ou anonimizar contatos a qualquer momento pelo
            próprio app.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">6. Direitos do titular</h2>
          <p>
            O titular pode solicitar confirmação de tratamento, acesso, correção, portabilidade,
            anonimização ou eliminação dos dados. A controladora atende esses pedidos; a Tervian
            apoia com exportação e exclusão pelo app.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">7. Segurança</h2>
          <p>
            Usamos HTTPS em todas as páginas, sessões httpOnly, senhas com hash forte, isolamento
            por conta (multi-tenant), rate limit nos fluxos de autenticação e registro de
            atividades. Incidentes de segurança são comunicados à controladora e aos titulares
            quando aplicável.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">8. Contato</h2>
          <p>
            Dúvidas sobre privacidade:{" "}
            <a href={`mailto:${PRIVACY_EMAIL}`} className="underline underline-offset-4">
              {PRIVACY_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        <Link href={TERMS_PATH} className="underline underline-offset-4">
          Ver termos de uso
        </Link>
      </p>
    </main>
  );
}
