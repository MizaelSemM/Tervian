import { z } from "zod";

/**
 * Validação de variáveis de ambiente (ver .notes/001-fundacao-setup.md).
 *
 * Regra do projeto: o resto do código NUNCA lê `process.env` diretamente —
 * tudo passa por `env`, validado uma única vez (falha rápido no boot).
 *
 * Na Vercel, as variáveis são configuradas em Project Settings → Environment Variables.
 */
const envSchema = z.object({
  // Banco de dados (Supabase — região São Paulo). Obrigatório: migrations e runtime dependem dele.
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((v) => v.startsWith("postgres"), {
      message: "DATABASE_URL deve ser uma connection string Postgres (postgresql://...)",
    }),

  // Autenticação (Better Auth) — obrigatório desde a tarefa 003.
  // Gere o segredo com: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  BETTER_AUTH_SECRET: z.string().min(32),
  // URL pública do app: links de e-mail (reset/convite) e origin check do Better Auth.
  BETTER_AUTH_URL: z.url(),

  // Fluxo de cadastro de novas empresas. `false` fecha /cadastro e o serviço de
  // signup; login, reset e aceite de convite NÃO são afetados. Padrão `true`
  // preserva o comportamento atual quem nunca configurou a variável.
  SIGNUPS_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),

  // E-mail transacional (Resend) — tarefas 003/009/015.
  // Sem a chave, o mailer registra o e-mail no console (dev) em vez de enviar.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Observabilidade — tarefa 013.
  SENTRY_DSN: z.url().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variáveis de ambiente inválidas:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".") || "(raiz)"}: ${issue.message}`);
  }
  throw new Error("Variáveis de ambiente inválidas — corrija o .env (veja .env.example).");
}

export const env = parsed.data;
