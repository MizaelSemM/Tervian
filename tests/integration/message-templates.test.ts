// Suíte dos modelos de mensagem (019) — roda contra o banco real.
//
// Cobre o seed padrão, CRUD, nome único, etapa sugerida e isolamento entre
// contas. Requer DATABASE_URL.
import { afterAll, describe, expect, it } from "vitest";

import { prismaBase } from "@/lib/prisma";
import { runWithTenant } from "@/lib/tenant-context";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  createDefaultMessageTemplatesForAccount,
  createMessageTemplate,
  deleteMessageTemplate,
  listMessageTemplates,
  updateMessageTemplate,
} from "@/server/services/message-templates";
import { createDefaultPipelineForAccount, getPipelineStages } from "@/server/services/pipeline";

const run = Math.random().toString(36).slice(2, 8);
const accountIds: string[] = [];

type Seeded = {
  accountId: string;
  admin: { id: string; name: string };
  seller: { id: string; name: string };
};

async function makeAccount(tag: string): Promise<Seeded> {
  const account = await prismaBase.account.create({
    data: { name: `[teste 019 template] ${tag} ${run}` },
  });
  accountIds.push(account.id);

  const admin = await prismaBase.user.create({
    data: {
      accountId: account.id,
      name: `Admin ${tag}`,
      email: `template-admin-${tag}-${run}@teste.tervian.dev`,
      role: "ADMIN",
    },
    select: { id: true, name: true },
  });
  const seller = await prismaBase.user.create({
    data: {
      accountId: account.id,
      name: `Vendedor ${tag}`,
      email: `template-seller-${tag}-${run}@teste.tervian.dev`,
      role: "SELLER",
    },
    select: { id: true, name: true },
  });

  return { accountId: account.id, admin, seller };
}

function asUser<T>(seeded: Seeded, role: "admin" | "seller", fn: () => Promise<T>): Promise<T> {
  const user = seeded[role];
  return runWithTenant({ accountId: seeded.accountId, userId: user.id }, fn);
}

afterAll(async () => {
  try {
    for (const accountId of accountIds) {
      await prismaBase.cadenceRule.deleteMany({ where: { accountId } });
      await prismaBase.messageTemplate.deleteMany({ where: { accountId } });
      await prismaBase.timelineEvent.deleteMany({ where: { accountId } });
      await prismaBase.note.deleteMany({ where: { accountId } });
      await prismaBase.task.deleteMany({ where: { accountId } });
      await prismaBase.deal.deleteMany({ where: { accountId } });
      await prismaBase.contact.deleteMany({ where: { accountId } });
      await prismaBase.lostReason.deleteMany({ where: { accountId } });
      await prismaBase.invite.deleteMany({ where: { accountId } });
      await prismaBase.stage.deleteMany({ where: { accountId } });
      await prismaBase.pipeline.deleteMany({ where: { accountId } });
      await prismaBase.user.deleteMany({ where: { accountId } });
      await prismaBase.account.deleteMany({ where: { id: accountId } });
    }
  } finally {
    await prismaBase.$disconnect();
  }
});

describe("modelos de mensagem (integração)", () => {
  it("cria os modelos padrão de forma idempotente e sugere a etapa do funil", async () => {
    const seeded = await makeAccount("seed");

    const templates = await asUser(seeded, "admin", () => listMessageTemplates());

    expect(templates).toHaveLength(DEFAULT_MESSAGE_TEMPLATES.length);
    const firstContact = templates.find((template) => template.name === "Primeiro contato");
    expect(firstContact?.suggestedStageName).toBe("Novo");
    expect(firstContact?.body).toContain("{nome}");

    const again = await asUser(seeded, "seller", () => listMessageTemplates());
    expect(again.map((template) => template.id).sort()).toEqual(
      templates.map((template) => template.id).sort(),
    );
  });

  it("permite criar, editar e excluir, mantendo o nome único sem caixa", async () => {
    const seeded = await makeAccount("crud");
    const stages = await asUser(seeded, "admin", () => getPipelineStages());

    const created = await asUser(seeded, "admin", () =>
      createMessageTemplate({
        name: "Pós-reunião",
        body: "Oi, {nome}! Obrigado pela conversa de hoje.",
        suggestedStageId: stages[1]?.id,
      }),
    );

    await expect(
      asUser(seeded, "admin", () =>
        createMessageTemplate({
          name: "pós-reunião",
          body: "Outro texto.",
        }),
      ),
    ).rejects.toMatchObject({ code: "TEMPLATE_NAME_TAKEN" });

    await asUser(seeded, "admin", () =>
      updateMessageTemplate({
        id: created.id,
        name: "Pós-reunião (novo)",
        body: "Oi, {nome}! Foi bom conversar com a {empresa}.",
      }),
    );

    const updated = (await asUser(seeded, "seller", () => listMessageTemplates())).find(
      (template) => template.id === created.id,
    );
    expect(updated?.name).toBe("Pós-reunião (novo)");
    expect(updated?.body).toContain("{empresa}");
    expect(updated?.suggestedStageId).toBeNull();

    await asUser(seeded, "admin", () => deleteMessageTemplate(created.id));

    const afterDelete = await asUser(seeded, "admin", () => listMessageTemplates());
    expect(afterDelete.some((template) => template.id === created.id)).toBe(false);
  });

  it("isola os modelos e as etapas entre contas", async () => {
    const accountA = await makeAccount("a");
    const accountB = await makeAccount("b");

    const stageA = (await asUser(accountA, "admin", () => getPipelineStages()))[0]!;
    const templateA = await asUser(accountA, "admin", () =>
      createMessageTemplate({
        name: "Só da conta A",
        body: "Oi, {nome}!",
        suggestedStageId: stageA.id,
      }),
    );

    const templatesB = await asUser(accountB, "admin", () => listMessageTemplates());
    expect(templatesB.some((template) => template.id === templateA.id)).toBe(false);

    await expect(
      asUser(accountB, "admin", () =>
        updateMessageTemplate({
          id: templateA.id,
          name: "Tentativa de edição",
          body: "Não deveria funcionar.",
        }),
      ),
    ).rejects.toMatchObject({ code: "TEMPLATE_NOT_FOUND" });

    await expect(
      asUser(accountB, "admin", () => deleteMessageTemplate(templateA.id)),
    ).rejects.toMatchObject({ code: "TEMPLATE_NOT_FOUND" });

    await expect(
      asUser(accountB, "admin", () =>
        createMessageTemplate({
          name: "Etapa de outra conta",
          body: "Oi, {nome}!",
          suggestedStageId: stageA.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "TEMPLATE_STAGE_INVALID" });
  });

  it("cria os modelos no cadastro, antes de existir contexto de request", async () => {
    const account = await prismaBase.account.create({
      data: { name: `[teste 019 signup] ${run}` },
    });
    accountIds.push(account.id);

    const pipeline = await createDefaultPipelineForAccount(account.id);
    await createDefaultMessageTemplatesForAccount(account.id);

    const rows = await prismaBase.messageTemplate.findMany({
      where: { accountId: account.id },
      orderBy: { name: "asc" },
    });

    expect(rows).toHaveLength(DEFAULT_MESSAGE_TEMPLATES.length);
    expect(rows.find((row) => row.name === "Primeiro contato")?.suggestedStageId).toBe(
      pipeline.stages[0]?.id,
    );
  });
});
