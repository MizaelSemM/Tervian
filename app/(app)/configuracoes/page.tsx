import { env } from "@/lib/env";
import { withAdmin } from "@/lib/session";
import { getPublicFormSettings, listPublicFormOwners } from "@/server/services/public-form";

import { PublicFormSettingsForm } from "./public-form-settings";

export const metadata = { title: "Configurações — Tervian" };

/**
 * Configurações da conta (tarefa 010) — por enquanto, só o formulário público.
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
      </div>
    );
  });
}
