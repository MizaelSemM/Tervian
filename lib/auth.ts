import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

import { getSignupContext } from "@/lib/auth-signup-context";
import { passwordResetEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { prismaBase } from "@/lib/prisma";

/**
 * Better Auth — autenticação do Tervian (tarefa 003).
 *
 * Decisões (ver .notes/003-auth-contas-convites.md):
 * - e-mail + senha com hash scrypt (padrão do Better Auth — decisão do 000);
 * - tabelas de auth são "de sistema": acessadas via `prismaBase`, nunca pelo
 *   client de tenant. No Prisma, o model `account` do Better Auth virou
 *   `AuthAccount` (o nosso `Account` é a conta/tenant);
 * - `accountId`, `role` e `active` do usuário são campos SERVER-OWNED
 *   (`input: false`): quem define é o hook de criação, lendo o contexto de
 *   cadastro (lib/auth-signup-context.ts) que só os NOSSOS fluxos abrem —
 *   chamada direta em `/api/auth/sign-up/email` é rejeitada;
 * - usuário desativado não cria sessão nova (`session.create.before`);
 * - trocar a senha revoga todas as sessões (sessão roubada morre junto);
 * - e-mail de reset sai pelo Resend quando configurado; sem chave, o mailer
 *   registra a mensagem no console (dev).
 */

const PASSWORD_RESET_TTL_SECONDS = 60 * 60; // 1 hora (RF-01: "expiração curta")

export const auth = betterAuth({
  appName: "Tervian",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  database: prismaAdapter(prismaBase, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: PASSWORD_RESET_TTL_SECONDS,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      try {
        await sendEmail(passwordResetEmail({ to: user.email, name: user.name, url }));
      } catch (error) {
        // Falha de e-mail não deve estourar a resposta do endpoint (o token já
        // foi gravado; o usuário pode pedir de novo). Loga para investigação.
        console.error("[auth] Falha ao enviar e-mail de redefinição de senha:", error);
      }
    },
  },

  user: {
    additionalFields: {
      // Vínculo com a conta (tenant) — obrigatório no banco, definido pelo servidor.
      accountId: { type: "string", required: false, input: false },
      // Papel no time: ADMIN ou SELLER (RF-02/RF-03).
      role: { type: ["ADMIN", "SELLER"], required: false, input: false },
      // Desativação sem apagar histórico (RF-02).
      active: { type: "boolean", required: false, input: false },
    },
  },

  // Renomeia o model `account` do Better Auth (credenciais) para não colidir com
  // o `Account` (conta/tenant). O valor é a propriedade do client Prisma.
  account: { modelName: "authAccount" },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const context = getSignupContext();
          if (!context) {
            // Bloqueia o endpoint público: no Tervian, cadastro só pelo nosso
            // formulário (criação de empresa) ou pelo aceite de convite.
            throw new APIError("FORBIDDEN", {
              message: "Cadastro permitido apenas pelos fluxos do Tervian.",
            });
          }
          return {
            data: { ...user, accountId: context.accountId, role: context.role },
          };
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await prismaBase.user.findUnique({
            where: { id: session.userId },
            select: { active: true },
          });
          if (!user || !user.active) {
            throw new APIError("FORBIDDEN", {
              message: "Este acesso está desativado. Fale com o administrador da sua equipe.",
            });
          }
        },
      },
    },
  },

  // Rate limit (proteção contra força bruta). Só vale para requisições vindas do
  // client — chamadas server-side `auth.api.*` não passam pelo limiter.
  // Regras padrão já cobrem /sign-in* e /sign-up* (3 req/10s por IP);
  // aqui apertamos a recuperação de senha: 5 pedidos a cada 5 minutos por IP.
  rateLimit: {
    enabled: true,
    customRules: {
      "/request-password-reset": { window: 300, max: 5 },
    },
  },

  // Deve ser o ÚLTIMO plugin: aplica os cookies de sessão quando o Better Auth é
  // chamado de dentro de Server Actions/RSC (onde a resposta HTTP é do Next).
  plugins: [nextCookies()],
});

/** Tipo do construtor (útil para tipar helpers e os serviços de `server/`). */
export type Auth = typeof auth;
