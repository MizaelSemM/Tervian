import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/lib/env";
import { PRIVACY_PATH, TERMS_PATH } from "@/lib/lgpd";
import { withAdmin } from "@/lib/session";
import { getPublicFormSettings, listPublicFormOwners } from "@/server/services/public-form";

import { PublicFormSettingsForm } from "./public-form-settings";

export const metadata = { title: "Configurações — Tervian" };

/**
 * Configurações da conta (010 + 013): formulário público e privacidade/LGPD.
 * Só ADMIN acessa; `withAdmin` abre o contexto de tenant usado pelos serviços.
 */
export default async function SettingsPage() {
  return withAdmin(async () => {
    const [settings, owners] = await Promise.all([getPublicFormSettings(), listPublicFormOwners()]);

    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">
            Personalize como novos leads chegam na sua operação.
          </p>
        </div>

        <PublicFormSettingsForm settings={settings} owners={owners} baseUrl={env.BETTER_AUTH_URL} />

        <Card>
          <CardHeader>
            <CardTitle>Privacidade e dados (LGPD)</CardTitle>
            <CardDescription>
              Exporte todos os dados da conta para atender um pedido do titular ou levar embora o
              que é seu. Contatos individuais têm a própria exportação/exclusão no detalhe.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <a
              href="/api/lgpd/export"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Baixar todos os dados (JSON)
            </a>
            <Link
              href={PRIVACY_PATH}
              target="_blank"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Política de privacidade
            </Link>
            <Link
              href={TERMS_PATH}
              target="_blank"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Termos de uso
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  });
}
