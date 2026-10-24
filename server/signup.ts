import { auth } from "@/lib/auth";
import { runWithSignupContext } from "@/lib/auth-signup-context";
import { prismaBase } from "@/lib/prisma";
import type { SignUpCompanyInput } from "@/lib/schemas/auth";
import { isAlreadyExistsError } from "@/server/auth-errors";
import { AppError } from "@/server/errors";
import { createDefaultLostReasonsForAccount } from "@/server/services/lost-reasons";
import { createDefaultPipelineForAccount } from "@/server/services/pipeline";

/**
 * Criação de empresa (RF-01): nova conta (tenant) + primeiro usuário ADMIN.
 *
 * Fluxo:
 *  1. e-mail não pode existir (checagem antecipada para não criar conta em vão);
 *  2. cria o `Account`;
 *  3. cria o funil padrão (RF-20) e os motivos de perda (RF-23);
 *  4. cria o usuário via Better Auth DENTRO do contexto de cadastro — o hook
 *     `user.create.before` (lib/auth.ts) injeta `accountId` + `role: ADMIN`;
 *  5. qualquer falha remove tudo que foi criado (rollback compensatório).
 *
 * O usuário já sai logado (o Better Auth cria sessão + cookie no cadastro).
 */
export async function signUpCompany(
  input: SignUpCompanyInput,
): Promise<{ accountId: string; userId: string }> {
  const existing = await prismaBase.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(
      "EMAIL_TAKEN",
      "Este e-mail já está cadastrado. Entre com ele ou use outro endereço.",
    );
  }

  const account = await prismaBase.account.create({ data: { name: input.companyName } });

  try {
    await createDefaultPipelineForAccount(account.id);
    await createDefaultLostReasonsForAccount(account.id);

    const result = await runWithSignupContext({ accountId: account.id, role: "ADMIN" }, () =>
      auth.api.signUpEmail({
        body: { name: input.name, email: input.email, password: input.password },
      }),
    );
    return { accountId: account.id, userId: result.user.id };
  } catch (error) {
    await rollbackAccount(account.id);

    if (isAlreadyExistsError(error)) {
      throw new AppError(
        "EMAIL_TAKEN",
        "Este e-mail já está cadastrado. Entre com ele ou use outro endereço.",
      );
    }
    console.error("[signup] Erro inesperado no cadastro de empresa:", error);
    throw new AppError(
      "SIGNUP_FAILED",
      "Não foi possível criar a conta agora. Tente novamente em instantes.",
    );
  }
}

/**
 * Remove tudo que o cadastro criou (inclusive o funil padrão), para não deixar
 * conta órfã quando o Better Auth falha. `user.deleteMany` cascateia sessões,
 * credenciais e convites criados.
 */
async function rollbackAccount(accountId: string): Promise<void> {
  try {
    await prismaBase.$transaction(async (tx) => {
      await tx.lostReason.deleteMany({ where: { accountId } });
      await tx.stage.deleteMany({ where: { accountId } });
      await tx.pipeline.deleteMany({ where: { accountId } });
      await tx.user.deleteMany({ where: { accountId } });
      await tx.account.deleteMany({ where: { id: accountId } });
    });
  } catch (cleanupError) {
    console.error("[signup] Falha ao remover a conta órfã:", cleanupError);
  }
}
