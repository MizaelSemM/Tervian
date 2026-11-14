import { z } from "zod";

/**
 * Validação da autenticação (tarefa 003) — compartilhada entre formulários
 * (client) e o servidor. REGRA: o servidor SEMPRE revalida com estes schemas;
 * validar no client é só conveniência de UX.
 */

// Normaliza ANTES de validar: "  A@B.COM  " vira "a@b.com".
const emailField = z
  .string({ message: "Informe seu e-mail." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "E-mail inválido." }));

const nameField = z
  .string({ message: "Informe seu nome." })
  .trim()
  .min(2, { message: "Informe seu nome completo (mín. 2 caracteres)." })
  .max(80, { message: "O nome pode ter no máximo 80 caracteres." });

const companyNameField = z
  .string({ message: "Informe o nome da empresa." })
  .trim()
  .min(2, { message: "Informe o nome da empresa (mín. 2 caracteres)." })
  .max(80, { message: "O nome da empresa pode ter no máximo 80 caracteres." });

// Mesmos limites do Better Auth (minPasswordLength/maxPasswordLength — lib/auth.ts).
const passwordField = z
  .string({ message: "Informe uma senha." })
  .min(8, { message: "A senha precisa de pelo menos 8 caracteres." })
  .max(128, { message: "A senha pode ter no máximo 128 caracteres." });

/** Cadastro de empresa: cria a conta + primeiro usuário (ADMIN). */
export const signUpCompanySchema = z.object({
  companyName: companyNameField,
  name: nameField,
  email: emailField,
  password: passwordField,
  // LGPD: o aceite é obrigatório e fica registrado na conta (data + versão).
  acceptTerms: z.literal(true, {
    message: "Para criar a conta, aceite os termos de uso e a política de privacidade.",
  }),
});

/** Login — usado apenas no client (o Better Auth valida de novo no servidor). */
export const loginSchema = z.object({
  email: emailField,
  password: z.string({ message: "Informe sua senha." }).min(1, { message: "Informe sua senha." }),
});

/** Pedido de recuperação de senha. */
export const requestPasswordResetSchema = z.object({
  email: emailField,
});

/** Definição de nova senha (link do e-mail) — token + senha + confirmação. */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, { message: "Link inválido — peça um novo e-mail." }),
    newPassword: passwordField,
    confirmPassword: z.string({ message: "Repita a senha." }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"],
  });

/** Convite (ADMIN): e-mail do convidado + papel. */
export const createInviteSchema = z.object({
  email: emailField,
  role: z.enum(["ADMIN", "SELLER"], { message: "Escolha o papel do convite." }),
});

/** Aceite de convite (público): token do link + dados do usuário. */
export const acceptInviteSchema = z.object({
  token: z.string().min(10, { message: "Convite inválido." }),
  name: nameField,
  password: passwordField,
});

export type SignUpCompanyInput = z.infer<typeof signUpCompanySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

/** Primeira mensagem de erro de um ZodError (as mensagens já vêm em pt-BR). */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
