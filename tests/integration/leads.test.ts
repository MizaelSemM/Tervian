// Suíte de captura de lead (005) — roda contra o banco real.
//
// Cobre a regra do PRD: nome + telefone criam contato, negócio na etapa "Novo",
// tarefa "Primeiro contato" para hoje e evento na timeline; duplicado avisa sem
// duplicar; funil padrão é criado para contas antigas; vendedor não atribui a
// terceiros. Limpa tudo no final. Requer DATABASE_URL.
import { afterAll, describe, expect, it } from "vitest";

import { prismaBase } from "@/lib/prisma";
import { runWithTenant } from "@/lib/tenant-context";
import { createLead } from "@/server/services/leads";
import { ensureDefaultPipeline } from "@/server/services/pipeline";

const run = Math.random().toString(36).slice(2, 8);
const accountIds: string[] = [];

type Seeded = Awaited<ReturnType<typeof makeAccount>>;

async function makeAccount(tag: string): Promise<{
  account: { id: string; name: string };
  admin: { id: string };
  seller: { id: string };
}> {
  const account = await prismaBase.account.create({
    data: { name: `[teste 005 lead] ${tag} ${run}` },
  });
  accountIds.push(account.id);

  const admin = await prismaBase.user.create({
    data: {
      accountId: account.id,
      name: `Admin ${tag}`,
      email: `lead-admin-${tag}-${run}@teste.tervian.dev`,
      role: "ADMIN",
    },
  });
  const seller = await prismaBase.user.create({
    data: {
      accountId: account.id,
      name: `Vendedor ${tag}`,
      email: `lead-seller-${tag}-${run}@teste.tervian.dev`,
      role: "SELLER",
    },
  });

  return { account: { id: account.id, name: account.name }, admin, seller };
}

function asUser<T>(seeded: Seeded, role: "admin" | "seller", fn: () => Promise<T>): Promise<T> {
  const user = seeded[role];
  return runWithTenant({ accountId: seeded.account.id, userId: user.id }, fn);
}

afterAll(async () => {
  try {
    for (const accountId of accountIds) {
      await prismaBase.timelineEvent.deleteMany({ where: { accountId } });
      await prismaBase.note.deleteMany({ where: { accountId } });
      await prismaBase.task.deleteMany({ where: { accountId } });
      await prismaBase.deal.deleteMany({ where: { accountId } });
      await prismaBase.contact.deleteMany({ where: { accountId } });
      await prismaBase.cadenceRule.deleteMany({ where: { accountId } });
      await prismaBase.messageTemplate.deleteMany({ where: { accountId } });
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

describe("createLead (integração)", () => {
  it("cria contato, negócio na etapa Novo, tarefa para hoje, timeline e funil padrão", async () => {
    const seeded = await makeAccount("create");

    const result = await asUser(seeded, "admin", () =>
      createLead({
        actingUser: { id: seeded.admin.id, role: "ADMIN" },
        name: "  Carla Mendes ",
        phone: "(11) 98765-4321",
        email: " CARLA@EMPRESA.COM ",
        companyText: " Loja da Carla ",
        origin: "INSTAGRAM",
        source: "manual",
        captureSeconds: 12,
      }),
    );

    expect(result.status).toBe("created");
    if (result.status !== "created") return;

    const contact = await prismaBase.contact.findUniqueOrThrow({ where: { id: result.contactId } });
    expect(contact.accountId).toBe(seeded.account.id);
    expect(contact.name).toBe("Carla Mendes");
    expect(contact.phone).toBe("+5511987654321");
    expect(contact.email).toBe("carla@empresa.com");
    expect(contact.companyText).toBe("Loja da Carla");
    expect(contact.origin).toBe("INSTAGRAM");
    expect(contact.ownerId).toBe(seeded.admin.id);

    const pipelines = await prismaBase.pipeline.findMany({
      where: { accountId: seeded.account.id },
      include: { stages: { orderBy: { position: "asc" } } },
    });
    expect(pipelines).toHaveLength(1);
    expect(pipelines[0]?.stages.map((stage) => stage.name)).toEqual([
      "Novo",
      "Contatado",
      "Proposta enviada",
      "Negociação",
    ]);

    const deal = await prismaBase.deal.findUniqueOrThrow({ where: { id: result.dealId } });
    expect(deal.title).toBe("Carla Mendes");
    expect(deal.stageId).toBe(pipelines[0]?.stages[0]?.id);
    expect(deal.status).toBe("OPEN");
    expect(deal.ownerId).toBe(seeded.admin.id);
    expect(deal.lastActivityAt).not.toBeNull();

    const task = await prismaBase.task.findUniqueOrThrow({ where: { id: result.taskId } });
    expect(task.title).toBe("Primeiro contato");
    expect(task.type).toBe("WHATSAPP");
    expect(task.completedAt).toBeNull();
    expect(task.ownerId).toBe(seeded.admin.id);
    expect(task.dueAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(deal.nextActionAt?.getTime()).toBe(task.dueAt.getTime());

    const events = await prismaBase.timelineEvent.findMany({
      where: { accountId: seeded.account.id, dealId: result.dealId },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("deal.created");
    expect(events[0]?.payload).toMatchObject({ stage: "Novo", source: "manual" });
  });

  it("telefone duplicado devolve o contato existente e não cria outro negócio", async () => {
    const seeded = await makeAccount("duplicate");

    const first = await asUser(seeded, "admin", () =>
      createLead({
        actingUser: { id: seeded.admin.id, role: "ADMIN" },
        name: "Carla Mendes",
        phone: "11987654321",
      }),
    );
    expect(first.status).toBe("created");
    if (first.status !== "created") return;

    const second = await asUser(seeded, "admin", () =>
      createLead({
        actingUser: { id: seeded.admin.id, role: "ADMIN" },
        name: "Outra Pessoa",
        phone: "+55 (11) 98765-4321",
      }),
    );

    expect(second.status).toBe("duplicate");
    if (second.status !== "duplicate") return;
    expect(second.contact).toMatchObject({ id: first.contactId, deleted: false });

    expect(await prismaBase.contact.count({ where: { accountId: seeded.account.id } })).toBe(1);
    expect(await prismaBase.deal.count({ where: { accountId: seeded.account.id } })).toBe(1);
    expect(await prismaBase.task.count({ where: { accountId: seeded.account.id } })).toBe(1);
  });

  it("recusa telefone inválido e nome curto sem criar nada", async () => {
    const seeded = await makeAccount("invalid");

    await expect(
      asUser(seeded, "admin", () =>
        createLead({
          actingUser: { id: seeded.admin.id, role: "ADMIN" },
          name: "Carla Mendes",
          phone: "1234",
        }),
      ),
    ).rejects.toMatchObject({ code: "LEAD_PHONE_INVALID" });

    await expect(
      asUser(seeded, "admin", () =>
        createLead({
          actingUser: { id: seeded.admin.id, role: "ADMIN" },
          name: "C",
          phone: "11987654321",
        }),
      ),
    ).rejects.toMatchObject({ code: "LEAD_NAME_INVALID" });

    expect(await prismaBase.contact.count({ where: { accountId: seeded.account.id } })).toBe(0);
    expect(await prismaBase.pipeline.count({ where: { accountId: seeded.account.id } })).toBe(0);
  });

  it("vendedor não atribui a outro; admin atribui a qualquer membro ativo", async () => {
    const seeded = await makeAccount("owner");

    await expect(
      asUser(seeded, "seller", () =>
        createLead({
          actingUser: { id: seeded.seller.id, role: "SELLER" },
          name: "Carla Mendes",
          phone: "11987654321",
          ownerId: seeded.admin.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "OWNER_FORBIDDEN" });

    const result = await asUser(seeded, "admin", () =>
      createLead({
        actingUser: { id: seeded.admin.id, role: "ADMIN" },
        name: "Bruno Lima",
        phone: "11987654322",
        ownerId: seeded.seller.id,
      }),
    );
    expect(result.status).toBe("created");
    if (result.status !== "created") return;

    const contact = await prismaBase.contact.findUniqueOrThrow({ where: { id: result.contactId } });
    const deal = await prismaBase.deal.findUniqueOrThrow({ where: { id: result.dealId } });
    const task = await prismaBase.task.findUniqueOrThrow({ where: { id: result.taskId } });
    expect(contact.ownerId).toBe(seeded.seller.id);
    expect(deal.ownerId).toBe(seeded.seller.id);
    expect(task.ownerId).toBe(seeded.seller.id);
  });

  it("ensureDefaultPipeline é idempotente e reaproveita o funil existente", async () => {
    const seeded = await makeAccount("pipeline");

    const first = await asUser(seeded, "admin", () => ensureDefaultPipeline());
    const second = await asUser(seeded, "admin", () => ensureDefaultPipeline());

    expect(second.pipelineId).toBe(first.pipelineId);
    expect(second.newStage.id).toBe(first.newStage.id);
    expect(await prismaBase.pipeline.count({ where: { accountId: seeded.account.id } })).toBe(1);
    expect(await prismaBase.stage.count({ where: { accountId: seeded.account.id } })).toBe(4);
  });
});
