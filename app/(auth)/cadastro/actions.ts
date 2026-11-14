"use server";

import { redirect } from "next/navigation";

import { firstIssueMessage, signUpCompanySchema } from "@/lib/schemas/auth";
import { AppError } from "@/server/errors";
import { signUpCompany } from "@/server/signup";

/** Campos devolvidos ao formulário para não perder o que a pessoa digitou. */
export type SignUpFormValues = { companyName: string; name: string; email: string };

/** Estado do formulário de cadastro (erro em pt-BR; `null` = inicial). */
export type SignUpFormState = { error: string; values?: SignUpFormValues } | null;

function submittedValues(formData: FormData): SignUpFormValues {
  return {
    companyName: String(formData.get("companyName") ?? ""),
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
}

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
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error), values: submittedValues(formData) };
  }

  try {
    await signUpCompany(parsed.data);
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.message, values: submittedValues(formData) };
    }
    console.error("[cadastro] Erro inesperado:", error);
    return {
      error: "Não foi possível criar a conta agora. Tente novamente em instantes.",
      values: submittedValues(formData),
    };
  }

  // Sucesso: a sessão já foi criada (cookie via nextCookies) — entra direto.
  redirect("/");
}
