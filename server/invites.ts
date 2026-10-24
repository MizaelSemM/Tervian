import { randomBytes } from "node:crypto";

import { auth } from "@/lib/auth";
import { runWithSignupContext } from "@/lib/auth-signup-context";
import { inviteEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { prismaBase } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant-context";
import { tenantDb } from "@/lib/tenant-prisma";
import { isAlreadyExistsError } from "@/server/auth-errors";
import { AppError } from "@/server/errors";

/**
 * Convites de equipe (RF-04).
 *
 * - Criação/listagem/revogação são operações de ADMIN, presas à conta pelo
 *   client de tenant (`tenantDb()` exige contexto — use `withAdmin`).
 * - Aceite é PÚBLICO (usuário ainda não existe): roda no client de sistema
 *   (`prismaBase`) com claim atômico do token (UPDATE condicional) para uso
 *   único mesmo com cliques duplos.
 * - O token é aleatório de 32 caracteres (base64url) e vale 7 dias; o link é
 *   enviado por e-mail (ou registrado no console, em dev — ver lib/email.ts).
 */

export const INVITE_TTL_DAYS = 7;

export type InviteRole = "ADMIN" | "SELLER";

export type InviteSummary = {
  id: string;
  email: string;
  role: InviteRole;
  url: string;
  expiresAt: Date;
  createdAt: Date;
};

export type CreateInviteResult = { invite: InviteSummary; emailDelivered: boolean };

function buildInviteUrl(token: string): string {
  return `${env.BETTER_AUTH_URL}/convite/${token}`;
}

/** Cria (ou reenvia — revoga o anterior) um convite. Requer contexto de tenant. */
export async function createInvite(input: {
  createdById: string;
  email: string;
  role: InviteRole;
}): Promise<CreateInviteResult> {
  const db = tenantDb();

  const memberHere = await db.user.findFirst({
    where: { email: input.email },
    select: { id: true },
  });
  if (memberHere) {
    throw new AppError("MEMBER_EXISTS", "Esta pessoa já faz parte da sua equipe.");
  }

  const elsewhere = await prismaBase.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (elsewhere) {
    throw new AppError(
      "EMAIL_TAKEN",
      "Este e-mail já tem uma conta no Tervian (cada e-mail pertence a uma única conta).",
    );
  }

  // Reenviar convite = criar outro: o pendente do mesmo e-mail é revogado.
  await db.invite.updateMany({
    where: { email: input.email, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invite = await db.invite.create({
    data: {
      // Vem do contexto (nunca de parâmetro do client); o client de tenant
      // re-carimba o valor em runtime — o campo aqui é exigência do tipo.
      accountId: requireTenantContext().accountId,
      email: input.email,
      role: input.role,
      token,
      createdById: input.createdById,
      expiresAt,
    },
  });

  const account = await db.account.findFirst({ select: { name: true } });
  const url = buildInviteUrl(token);
  const { delivered } = await sendEmail(
    inviteEmail({
      to: input.email,
      accountName: account?.name ?? "sua equipe",
      role: invite.role,
      url,
    }),
  );

  return {
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      url,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    },
    emailDelivered: delivered,
  };
}

/** Convites pendentes da conta atual (com o link para copiar/reenviar). */
export async function listPendingInvites(): Promise<InviteSummary[]> {
  const db = tenantDb();
  const invites = await db.invite.findMany({
    where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, token: true, expiresAt: true, createdAt: true },
  });
  return invites.map((invite) => ({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    url: buildInviteUrl(invite.token),
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
  }));
}

/** Revoga um convite pendente. Requer contexto de tenant. */
export async function revokeInvite(input: { inviteId: string }): Promise<void> {
  const db = tenantDb();
  const result = await db.invite.updateMany({
    where: { id: input.inviteId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) {
    throw new AppError("INVITE_NOT_FOUND", "Convite não encontrado ou já utilizado.");
  }
}

// ---------------------------------------------------------------- Aceite (público)

export type PublicInvite = {
  email: string;
  role: InviteRole;
  accountName: string;
  expiresAt: Date;
  status: "valid" | "expired" | "used" | "revoked";
};

/** Convite para a tela pública `/convite/[token]` (sem autenticação). */
export async function findInviteForPublicPage(token: string): Promise<PublicInvite | null> {
  const invite = await prismaBase.invite.findUnique({
    where: { token },
    select: {
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      account: { select: { name: true } },
    },
  });
  if (!invite) return null;

  const status = invite.acceptedAt
    ? "used"
    : invite.revokedAt
      ? "revoked"
      : invite.expiresAt.getTime() <= Date.now()
        ? "expired"
        : "valid";

  return {
    email: invite.email,
    role: invite.role,
    accountName: invite.account.name,
    expiresAt: invite.expiresAt,
    status,
  };
}

/**
 * Aceita o convite: cria o usuário já vinculado à conta, com o papel do convite.
 * O usuário sai logado (sessão + cookie criados pelo Better Auth).
 */
export async function acceptInvite(input: {
  token: string;
  name: string;
  password: string;
}): Promise<{ accountId: string; userId: string }> {
  const invite = await prismaBase.invite.findUnique({
    where: { token: input.token },
    select: {
      id: true,
      accountId: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
    },
  });

  if (!invite) {
    throw new AppError("INVITE_INVALID", "Convite não encontrado. Confira o link ou peça outro.");
  }
  if (invite.acceptedAt) {
    throw new AppError(
      "INVITE_USED",
      "Este convite já foi utilizado. Peça outro ao administrador.",
    );
  }
  if (invite.revokedAt) {
    throw new AppError(
      "INVITE_REVOKED",
      "Este convite foi cancelado. Peça outro ao administrador.",
    );
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    throw new AppError("INVITE_EXPIRED", "Este convite expirou. Peça outro ao administrador.");
  }

  const existing = await prismaBase.user.findUnique({
    where: { email: invite.email },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(
      "EMAIL_TAKEN",
      "Este e-mail já tem uma conta no Tervian. Entre com a sua senha ou peça a recuperação.",
    );
  }

  // Claim atômico: se outro request aceitou/revogou/expirou primeiro, count = 0.
  const claimed = await prismaBase.invite.updateMany({
    where: { id: invite.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { acceptedAt: new Date() },
  });
  if (claimed.count === 0) {
    throw new AppError("INVITE_INVALID", "Convite inválido ou já utilizado. Peça outro.");
  }

  try {
    const result = await runWithSignupContext(
      { accountId: invite.accountId, role: invite.role },
      () =>
        auth.api.signUpEmail({
          body: { name: input.name, email: invite.email, password: input.password },
        }),
    );
    return { accountId: invite.accountId, userId: result.user.id };
  } catch (error) {
    // Devolve o convite a "pendente" para permitir nova tentativa (ex.: erro de senha).
    await prismaBase.invite
      .updateMany({ where: { id: invite.id }, data: { acceptedAt: null } })
      .catch((cleanupError) => {
        console.error("[invite] Falha ao liberar o convite após erro:", cleanupError);
      });

    if (isAlreadyExistsError(error)) {
      throw new AppError(
        "EMAIL_TAKEN",
        "Este e-mail já tem uma conta no Tervian. Entre com a sua senha ou peça a recuperação.",
      );
    }
    console.error("[invite] Erro inesperado no aceite do convite:", error);
    throw new AppError(
      "ACCEPT_FAILED",
      "Não foi possível aceitar o convite agora. Tente novamente em instantes.",
    );
  }
}
