import { prismaBase } from "@/lib/prisma";
import { PUBLIC_FORM_DEFAULT_MESSAGE, PUBLIC_FORM_DEFAULT_TITLE } from "@/lib/public-form";
import type { PublicFormSettingsInput } from "@/lib/schemas/public-form";
import { requireTenantContext } from "@/lib/tenant-context";
import { tenantDb } from "@/lib/tenant-prisma";
import { AppError } from "@/server/errors";

/**
 * Formulário público de captura (tarefa 010).
 *
 * Duas leituras diferentes:
 * - `loadPublicFormAccount()` usa `prismaBase` porque a rota `/f/[slug]` é
 *   pública (não há sessão para abrir o contexto de tenant);
 * - as funções de configuração usam `tenantDb()` e só rodam para ADMIN.
 */

export type PublicFormSettings = {
  accountName: string;
  slug: string;
  enabled: boolean;
  title: string;
  message: string;
  whatsapp: string | null;
  ownerId: string | null;
};

export type PublicFormAccount = {
  id: string;
  name: string;
  slug: string;
  title: string;
  message: string;
  whatsapp: string | null;
  ownerId: string | null;
};

const publicFormSelect = {
  id: true,
  name: true,
  publicFormSlug: true,
  publicFormEnabled: true,
  publicFormTitle: true,
  publicFormMessage: true,
  publicFormWhatsapp: true,
  publicFormOwnerId: true,
} as const;

/** Conta dona do link público (por slug OU pelo id legado). `null` se desativada. */
export async function loadPublicFormAccount(slugOrId: string): Promise<PublicFormAccount | null> {
  const account = await prismaBase.account.findFirst({
    where: {
      publicFormEnabled: true,
      OR: [{ publicFormSlug: slugOrId }, { id: slugOrId }],
    },
    select: publicFormSelect,
  });
  if (!account) return null;

  return {
    id: account.id,
    name: account.name,
    slug: account.publicFormSlug ?? account.id,
    title: account.publicFormTitle?.trim() || PUBLIC_FORM_DEFAULT_TITLE,
    message: account.publicFormMessage?.trim() || PUBLIC_FORM_DEFAULT_MESSAGE,
    whatsapp: account.publicFormWhatsapp,
    ownerId: account.publicFormOwnerId,
  };
}

/**
 * Responsável padrão do lead do formulário: o configurado (se ainda estiver
 * ativo nesta conta) ou o primeiro usuário ativo (Admin primeiro).
 */
export async function resolvePublicFormOwner(
  accountId: string,
  preferredOwnerId: string | null,
): Promise<{ id: string } | null> {
  if (preferredOwnerId) {
    const preferred = await prismaBase.user.findFirst({
      where: { id: preferredOwnerId, accountId, active: true },
      select: { id: true },
    });
    if (preferred) return preferred;
  }

  return prismaBase.user.findFirst({
    where: { accountId, active: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
}

/** Configuração atual (tenant). Slug nulo em contas antigas cai no id. */
export async function getPublicFormSettings(): Promise<PublicFormSettings> {
  const account = await tenantDb().account.findFirst({
    where: {},
    select: publicFormSelect,
  });

  if (!account) throw new AppError("ACCOUNT_NOT_FOUND", "Conta não encontrada.");

  return {
    accountName: account.name,
    slug: account.publicFormSlug ?? account.id,
    enabled: account.publicFormEnabled,
    title: account.publicFormTitle?.trim() || PUBLIC_FORM_DEFAULT_TITLE,
    message: account.publicFormMessage?.trim() || PUBLIC_FORM_DEFAULT_MESSAGE,
    whatsapp: account.publicFormWhatsapp,
    ownerId: account.publicFormOwnerId,
  };
}

/** Usuários ativos que podem receber os leads do formulário. */
export async function listPublicFormOwners(): Promise<
  Array<{ id: string; name: string; role: "ADMIN" | "SELLER" }>
> {
  const users = await tenantDb().user.findMany({
    where: { active: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true },
  });
  return users;
}

export async function updatePublicFormSettings(
  input: PublicFormSettingsInput,
): Promise<PublicFormSettings> {
  const accountId = requireTenantContext().accountId;

  // O slug é um namespace global (a rota é /f/<slug>) — a checagem de conflito
  // precisa enxergar outras contas, por isso usa o client de sistema.
  const conflict = await prismaBase.account.findFirst({
    where: { publicFormSlug: input.slug, NOT: { id: accountId } },
    select: { id: true },
  });
  if (conflict) {
    throw new AppError("PUBLIC_FORM_SLUG_TAKEN", "Este link já está em uso. Escolha outro.");
  }

  if (input.ownerId) {
    const owner = await tenantDb().user.findFirst({
      where: { id: input.ownerId, active: true },
      select: { id: true },
    });
    if (!owner) {
      throw new AppError(
        "PUBLIC_FORM_OWNER_INVALID",
        "O responsável escolhido não está ativo nesta conta.",
      );
    }
  }

  await tenantDb().account.update({
    where: { id: accountId },
    data: {
      publicFormSlug: input.slug,
      publicFormEnabled: input.enabled,
      publicFormTitle: input.title,
      publicFormMessage: input.message,
      publicFormWhatsapp: input.whatsapp ?? null,
      publicFormOwnerId: input.ownerId ?? null,
    },
  });

  return getPublicFormSettings();
}
