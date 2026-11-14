"use server";

import { redirect } from "next/navigation";

import { firstIssueMessage, signUpCompanySchema } from "@/lib/schemas/auth";
import { AppError } from "@/server/errors";
import { signUpCompany } from "@/server/signup";

/** Estado do formulário de cadastro (erro em pt-BR; `null` = inicial). */
export type SignUpFormState = { error: string } | null;

export async function signUpCompanyAction(
  _previous: SignUpFormState,
  formData: FormData,
): Promise<SignUpFormState> {
  const parsed = signUpCompanySchema.safeParse({
    companyName: formData.get("companyName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    acceptTerms: formData.get("acceptTerms") === "on",
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  try {
    await signUpCompany(parsed.data);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    console.error("[cadastro] Erro inesperado:", error);
    return { error: "Não foi possível criar a conta agora. Tente novamente em instantes." };
  }

  // Sucesso: a sessão já foi criada (cookie via nextCookies) — entra direto.
  redirect("/");
}
