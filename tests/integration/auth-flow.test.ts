// Suíte de autenticação, convites e equipe (003) — roda contra o banco real.
//
// Cobre: cadastro de empresa (conta + ADMIN + credencial), bloqueio do endpoint
// público, login, reset de senha, convites (criar/aceitar/revogar/expirar),
// desativar/reativar com derrubada de sessões, e o guard do client de tenant
// para os models de autenticação. Limpa tudo no final. Requer DATABASE_URL.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/lib/auth";
import { prismaBase } from "@/lib/prisma";
import { runWithTenant } from "@/lib/tenant-context";
import { createTenantClient, TenantIsolationError } from "@/lib/tenant-prisma";
import {
  acceptInvite,
  createInvite,
  findInviteForPublicPage,
  listPendingInvites,
  revokeInvite,
} from "@/server/invites";
import { signUpCompany } from "@/server/signup";
import { deactivateUser, listTeam, reactivateUser } from "@/server/team";

const run = Math.random().toString(36).slice(2, 8);
const TEST_PASSWORD = "senha-de-teste-123";
const HOUR_MS = 60 * 60 * 1000;
const email = (tag: string) => `auth-${tag}-${run}@teste.tervian.dev`;
const tokenFromUrl = (url: string) => url.slice(url.lastIndexOf("/") + 1);

describe("auth: cadastro, convites e equipe (integração)", () => {
  const accountIds: string[] = [];
  const verificationIds: string[] = [];
  let admin: { accountId: string; userId: string };

  const asAdmin = <T>(fn: () => Promise<T>): Promise<T> =>
    runWithTenant({ accountId: admin.accountId, userId: admin.userId }, fn);

  beforeAll(async () => {
    admin = await signUpCompany({
      companyName: `[teste 003] Empresa ${run}`,
      name: "Administrador Teste",
      email: email("admin"),
      password: TEST_PASSWORD,
    });
    accountIds.push(admin.accountId);
  }, 30_000);

  afterAll(async () => {
    try {
      if (accountIds.length > 0) {
        // Cascatas: sessões, credenciais e convites (createdBy) caem com o usuário.
        await prismaBase.lostReason.deleteMany({ where: { accountId: { in: accountIds } } });
        await prismaBase.stage.deleteMany({ where: { accountId: { in: accountIds } } });
        await prismaBase.pipeline.deleteMany({ where: { accountId: { in: accountIds } } });
        await prismaBase.user.deleteMany({ where: { accountId: { in: accountIds } } });
        await prismaBase.account.deleteMany({ where: { id: { in: accountIds } } });
      }
      if (verificationIds.length > 0) {
        await prismaBase.verification.deleteMany({
          where: { identifier: { in: verificationIds } },
        });
      }
    } finally {
      await prismaBase.$disconnect();
    }
  });

  describe("cadastro de empresa", () => {
    it("cria conta + usuário ADMIN ativo + credencial com hash (sem senha em texto)", async () => {
      const user = await prismaBase.user.findUniqueOrThrow({ where: { id: admin.userId } });
      expect(user.accountId).toBe(admin.accountId);
      expect(user.role).toBe("ADMIN");
      expect(user.active).toBe(true);

      const credential = await prismaBase.authAccount.findFirst({
        where: { userId: admin.userId, providerId: "credential" },
      });
      expect(credential).not.toBeNull();
      expect(credential?.password).toBeTruthy();
      expect(credential?.password).not.toContain(TEST_PASSWORD);
      expect((credential?.password ?? "").length).toBeGreaterThan(20);

      const pipeline = await prismaBase.pipeline.findFirst({
        where: { accountId: admin.accountId },
        include: {
          stages: { orderBy: { position: "asc" }, select: { name: true } },
        },
      });
      expect(pipeline?.name).toBe("Comercial");
      expect(pipeline?.stages.map((stage) => stage.name)).toEqual([
        "Novo",
        "Contatado",
        "Proposta enviada",
        "Negociação",
      ]);
    });

    it("recusa e-mail já cadastrado e não deixa conta órfã", async () => {
      const companyName = `[teste 003] Duplicada ${run}`;
      await expect(
        signUpCompany({
          companyName,
          name: "Outro Usuário",
          email: email("admin"),
          password: TEST_PASSWORD,
        }),
      ).rejects.toThrow(/já está cadastrado/);

      expect(await prismaBase.account.count({ where: { name: companyName } })).toBe(0);
    });

    it("bloqueia o endpoint público de cadastro fora dos nossos fluxos", async () => {
      const banned = email("invasor");
      await expect(
        auth.api.signUpEmail({ body: { name: "Invasor", email: banned, password: TEST_PASSWORD } }),
      ).rejects.toThrow(/Cadastro permitido/);

      expect(await prismaBase.user.findUnique({ where: { email: banned } })).toBeNull();
    });
  });

  describe("login e recuperação de senha", () => {
    it("entra com a senha certa e recusa a senha errada", async () => {
      const ok = await auth.api.signInEmail({
        body: { email: email("admin"), password: TEST_PASSWORD },
      });
      expect(ok.user.id).toBe(admin.userId);

      await expect(
        auth.api.signInEmail({ body: { email: email("admin"), password: "senha-errada-000" } }),
      ).rejects.toThrow();
    });

    it("reset de senha: usa o token do banco, revoga sessões antigas e troca a senha", async () => {
      const created = await asAdmin(() =>
        createInvite({ createdById: admin.userId, email: email("reset"), role: "SELLER" }),
      );
      const seller = await acceptInvite({
        token: tokenFromUrl(created.invite.url),
        name: "Vendedor Reset",
        password: TEST_PASSWORD,
      });

      // Sessão de login existente, para provar a revogação no reset.
      await auth.api.signInEmail({ body: { email: email("reset"), password: TEST_PASSWORD } });
      expect(await prismaBase.session.count({ where: { userId: seller.userId } })).toBeGreaterThan(
        0,
      );

      await auth.api.requestPasswordReset({
        body: { email: email("reset"), redirectTo: "/redefinir-senha" },
      });

      // O token de reset fica em `verifications` como `reset-password:<token>`
      // (o e-mail em dev só loga o link — pegamos o token direto do banco).
      const verification = await prismaBase.verification.findFirst({
        where: { identifier: { startsWith: "reset-password:" } },
        orderBy: { createdAt: "desc" },
      });
      expect(verification).not.toBeNull();
      verificationIds.push(verification!.identifier);
      const token = verification!.identifier.slice("reset-password:".length);

      const newPassword = "senha-nova-123";
      await auth.api.resetPassword({ body: { newPassword, token } });

      // Uso único: o token some e as sessões antigas caem.
      expect(
        await prismaBase.verification.findFirst({
          where: { identifier: verification!.identifier },
        }),
      ).toBeNull();
      expect(await prismaBase.session.count({ where: { userId: seller.userId } })).toBe(0);

      await expect(
        auth.api.signInEmail({ body: { email: email("reset"), password: TEST_PASSWORD } }),
      ).rejects.toThrow();
      const again = await auth.api.signInEmail({
        body: { email: email("reset"), password: newPassword },
      });
      expect(again.user.id).toBe(seller.userId);
    }, 30_000);
  });

  describe("convites", () => {
    it("cria convite pendente com link de 32 caracteres, carimbando a conta", async () => {
      const created = await asAdmin(() =>
        createInvite({ createdById: admin.userId, email: email("vendedor"), role: "SELLER" }),
      );
      expect(created.invite.url).toContain("/convite/");
      expect(tokenFromUrl(created.invite.url)).toHaveLength(32);

      const row = await prismaBase.invite.findUniqueOrThrow({ where: { id: created.invite.id } });
      expect(row.accountId).toBe(admin.accountId);
      expect(row.acceptedAt).toBeNull();

      const pending = await asAdmin(() => listPendingInvites());
      expect(pending.map((invite) => invite.email)).toContain(email("vendedor"));
    });

    it("aceite vincula o usuário (SELLER), marca uso e bloqueia reutilização", async () => {
      const created = await asAdmin(() =>
        createInvite({ createdById: admin.userId, email: email("aceite"), role: "SELLER" }),
      );
      const token = tokenFromUrl(created.invite.url);

      const accepted = await acceptInvite({
        token,
        name: "Vendedor Aceite",
        password: TEST_PASSWORD,
      });
      expect(accepted.accountId).toBe(admin.accountId);

      const user = await prismaBase.user.findUniqueOrThrow({ where: { id: accepted.userId } });
      expect(user.accountId).toBe(admin.accountId);
      expect(user.role).toBe("SELLER");
      expect(user.active).toBe(true);

      const inviteRow = await prismaBase.invite.findUniqueOrThrow({ where: { token } });
      expect(inviteRow.acceptedAt).not.toBeNull();

      await expect(
        acceptInvite({ token, name: "De Novo", password: TEST_PASSWORD }),
      ).rejects.toThrow(/já foi utilizado/);
      expect((await findInviteForPublicPage(token))?.status).toBe("used");
    }, 30_000);

    it("convite revogado não pode ser aceito", async () => {
      const created = await asAdmin(() =>
        createInvite({ createdById: admin.userId, email: email("revogado"), role: "SELLER" }),
      );
      await asAdmin(() => revokeInvite({ inviteId: created.invite.id }));

      const token = tokenFromUrl(created.invite.url);
      await expect(acceptInvite({ token, name: "X", password: TEST_PASSWORD })).rejects.toThrow(
        /cancelado/,
      );
      expect((await findInviteForPublicPage(token))?.status).toBe("revoked");
    });

    it("convite expirado não pode ser aceito", async () => {
      const created = await asAdmin(() =>
        createInvite({ createdById: admin.userId, email: email("expirado"), role: "SELLER" }),
      );
      await prismaBase.invite.update({
        where: { id: created.invite.id },
        data: { expiresAt: new Date(Date.now() - HOUR_MS) },
      });

      const token = tokenFromUrl(created.invite.url);
      await expect(acceptInvite({ token, name: "X", password: TEST_PASSWORD })).rejects.toThrow(
        /expirou/,
      );
      expect((await findInviteForPublicPage(token))?.status).toBe("expired");
    });

    it("recusa convite para quem já faz parte da equipe", async () => {
      await expect(
        asAdmin(() =>
          createInvite({ createdById: admin.userId, email: email("admin"), role: "SELLER" }),
        ),
      ).rejects.toThrow(/já faz parte/);
    });
  });

  describe("gestão de equipe (desativar/reativar)", () => {
    it("desativa (derruba sessões), bloqueia login e reativa", async () => {
      const created = await asAdmin(() =>
        createInvite({ createdById: admin.userId, email: email("equipe"), role: "SELLER" }),
      );
      const seller = await acceptInvite({
        token: tokenFromUrl(created.invite.url),
        name: "Vendedor Equipe",
        password: TEST_PASSWORD,
      });

      await auth.api.signInEmail({ body: { email: email("equipe"), password: TEST_PASSWORD } });
      expect(await prismaBase.session.count({ where: { userId: seller.userId } })).toBeGreaterThan(
        0,
      );

      await asAdmin(() =>
        deactivateUser({ actingUserId: admin.userId, targetUserId: seller.userId }),
      );

      const after = await prismaBase.user.findUniqueOrThrow({ where: { id: seller.userId } });
      expect(after.active).toBe(false);
      expect(await prismaBase.session.count({ where: { userId: seller.userId } })).toBe(0);

      await expect(
        auth.api.signInEmail({ body: { email: email("equipe"), password: TEST_PASSWORD } }),
      ).rejects.toThrow(/desativado/);

      await asAdmin(() => reactivateUser({ targetUserId: seller.userId }));
      const back = await auth.api.signInEmail({
        body: { email: email("equipe"), password: TEST_PASSWORD },
      });
      expect(back.user.id).toBe(seller.userId);

      const team = await asAdmin(() => listTeam());
      expect(team.find((member) => member.id === seller.userId)?.active).toBe(true);
    }, 30_000);

    it("impede auto-desativação e protege o último administrador ativo", async () => {
      await expect(
        asAdmin(() => deactivateUser({ actingUserId: admin.userId, targetUserId: admin.userId })),
      ).rejects.toThrow(/próprio acesso/);

      await expect(
        asAdmin(() =>
          deactivateUser({ actingUserId: "outro-admin-qualquer", targetUserId: admin.userId }),
        ),
      ).rejects.toThrow(/único administrador/);
    });
  });

  describe("client de tenant x models de autenticação", () => {
    it("recusa session/authAccount/verification (models globais)", async () => {
      const db = createTenantClient(admin.accountId);
      await expect(db.session.findMany()).rejects.toThrow(TenantIsolationError);
      await expect(db.authAccount.findMany()).rejects.toThrow(TenantIsolationError);
      await expect(db.verification.findMany()).rejects.toThrow(TenantIsolationError);
    });

    it("convites listados pelo client de tenant têm o accountId da conta", async () => {
      const db = createTenantClient(admin.accountId);
      const invites = await db.invite.findMany();
      expect(invites.length).toBeGreaterThan(0);
      expect(invites.every((invite) => invite.accountId === admin.accountId)).toBe(true);
    });
  });
});
