// Suíte de isolamento multi-tenant (004) — roda contra o banco real.
//
// Cria duas contas temporárias com dados completos, tenta vazar dados de uma
// para a outra (ler, listar, atualizar, deletar e forjar account_id) e limpa
// tudo no final. Requer DATABASE_URL (ver .env).
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prismaBase } from "@/lib/prisma";
import { getTenantContext, runWithTenant, TenantContextMissingError } from "@/lib/tenant-context";
import { createTenantClient, tenantDb, TenantIsolationError } from "@/lib/tenant-prisma";

const run = Math.random().toString(36).slice(2, 8);

async function seedAccount(tag: "a" | "b") {
  const account = await prismaBase.account.create({
    data: { name: `[teste 004] Conta ${tag} ${run}` },
  });
  const accountId = account.id;

  const user = await prismaBase.user.create({
    data: { accountId, name: `Vendedor ${tag}`, email: `iso-${tag}-${run}@teste.tervian.dev` },
  });
  const pipeline = await prismaBase.pipeline.create({
    data: { accountId, name: `Comercial ${tag}` },
  });
  const stage = await prismaBase.stage.create({
    data: { accountId, pipelineId: pipeline.id, name: "Novo", position: 1 },
  });
  const contact = await prismaBase.contact.create({
    data: {
      accountId,
      name: `Contato ${tag}`,
      phone: `+551190000${tag === "a" ? "0" : "1"}${run.slice(0, 3)}`,
      ownerId: user.id,
    },
  });
  const deal = await prismaBase.deal.create({
    data: {
      accountId,
      title: `Negócio ${tag}`,
      stageId: stage.id,
      contactId: contact.id,
      ownerId: user.id,
    },
  });
  const task = await prismaBase.task.create({
    data: {
      accountId,
      dealId: deal.id,
      ownerId: user.id,
      type: "WHATSAPP",
      title: `Tarefa ${tag}`,
      dueAt: new Date(),
    },
  });
  const note = await prismaBase.note.create({
    data: { accountId, authorId: user.id, dealId: deal.id, text: `Nota ${tag}` },
  });
  const timelineEvent = await prismaBase.timelineEvent.create({
    data: {
      accountId,
      type: "test.created",
      dealId: deal.id,
      contactId: contact.id,
      actorId: user.id,
    },
  });

  return { account, user, pipeline, stage, contact, deal, task, note, timelineEvent };
}

type Seeded = Awaited<ReturnType<typeof seedAccount>>;

describe("isolamento multi-tenant (integração)", () => {
  let a: Seeded;
  let b: Seeded;
  let ta: ReturnType<typeof createTenantClient>;
  let tb: ReturnType<typeof createTenantClient>;

  beforeAll(async () => {
    a = await seedAccount("a");
    b = await seedAccount("b");
    ta = createTenantClient(a.account.id);
    tb = createTenantClient(b.account.id);
  });

  afterAll(async () => {
    try {
      if (a && b) {
        const ids = [a.account.id, b.account.id];
        await prismaBase.timelineEvent.deleteMany({ where: { accountId: { in: ids } } });
        await prismaBase.note.deleteMany({ where: { accountId: { in: ids } } });
        await prismaBase.task.deleteMany({ where: { accountId: { in: ids } } });
        await prismaBase.deal.deleteMany({ where: { accountId: { in: ids } } });
        await prismaBase.contact.deleteMany({ where: { accountId: { in: ids } } });
        await prismaBase.stage.deleteMany({ where: { accountId: { in: ids } } });
        await prismaBase.pipeline.deleteMany({ where: { accountId: { in: ids } } });
        await prismaBase.user.deleteMany({ where: { accountId: { in: ids } } });
        await prismaBase.account.deleteMany({ where: { id: { in: ids } } });
      }
    } finally {
      await prismaBase.$disconnect();
    }
  });

  it("isola leitura, update e delete de todas as entidades de conta", async () => {
    const cases = [
      {
        name: "contacts",
        list: () => ta.contact.findMany(),
        findForeign: () => ta.contact.findUnique({ where: { id: b.contact.id } }),
        updateForeign: () =>
          ta.contact.update({ where: { id: b.contact.id }, data: { name: "hack" } }),
        deleteForeign: () => ta.contact.delete({ where: { id: b.contact.id } }),
      },
      {
        name: "deals",
        list: () => ta.deal.findMany(),
        findForeign: () => ta.deal.findUnique({ where: { id: b.deal.id } }),
        updateForeign: () => ta.deal.update({ where: { id: b.deal.id }, data: { title: "hack" } }),
        deleteForeign: () => ta.deal.delete({ where: { id: b.deal.id } }),
      },
      {
        name: "tasks",
        list: () => ta.task.findMany(),
        findForeign: () => ta.task.findUnique({ where: { id: b.task.id } }),
        updateForeign: () => ta.task.update({ where: { id: b.task.id }, data: { title: "hack" } }),
        deleteForeign: () => ta.task.delete({ where: { id: b.task.id } }),
      },
      {
        name: "notes",
        list: () => ta.note.findMany(),
        findForeign: () => ta.note.findUnique({ where: { id: b.note.id } }),
        updateForeign: () => ta.note.update({ where: { id: b.note.id }, data: { text: "hack" } }),
        deleteForeign: () => ta.note.delete({ where: { id: b.note.id } }),
      },
    ];

    for (const c of cases) {
      const rows = await c.list();
      expect(rows.length, `${c.name}: lista só o da própria conta`).toBe(1);
      expect(rows[0].accountId, `${c.name}: carimbo da conta na leitura`).toBe(a.account.id);

      await expect(c.findForeign(), `${c.name}: leitura cruzada devolve null`).resolves.toBeNull();
      await expect(c.updateForeign(), `${c.name}: update cruzado falha`).rejects.toThrow();
      await expect(c.deleteForeign(), `${c.name}: delete cruzado falha`).rejects.toThrow();
    }

    // Nada foi alterado na conta B
    const bContact = await prismaBase.contact.findUnique({ where: { id: b.contact.id } });
    const bDeal = await prismaBase.deal.findUnique({ where: { id: b.deal.id } });
    expect(bContact?.name).toBe("Contato b");
    expect(bDeal?.title).toBe("Negócio b");
  });

  it("count e findFirst respeitam o filtro injetado", async () => {
    expect(await ta.contact.count()).toBe(1);
    expect(await ta.contact.count({ where: { id: b.contact.id } })).toBe(0);
    expect(await ta.contact.findFirst({ where: { id: b.contact.id } })).toBeNull();
  });

  it("updateMany/deleteMany na outra conta não afetam nada", async () => {
    const updated = await ta.contact.updateMany({
      where: { id: b.contact.id },
      data: { name: "hack" },
    });
    expect(updated.count).toBe(0);

    const deleted = await ta.task.deleteMany({ where: { id: b.task.id } });
    expect(deleted.count).toBe(0);

    const bContact = await prismaBase.contact.findUnique({ where: { id: b.contact.id } });
    const bTask = await prismaBase.task.findUnique({ where: { id: b.task.id } });
    expect(bContact?.name).toBe("Contato b");
    expect(bTask?.title).toBe("Tarefa b");
  });

  it("create com account_id forjado é carimbado com a conta ativa", async () => {
    const created = await ta.contact.create({
      data: {
        name: "Contato forjado",
        phone: "+5511999990000",
        accountId: b.account.id, // tentativa de forjar a conta B
      },
    });
    expect(created.accountId).toBe(a.account.id);

    // No banco, o registro pertence à conta A mesmo
    const raw = await prismaBase.contact.findUnique({ where: { id: created.id } });
    expect(raw?.accountId).toBe(a.account.id);

    // Limpa para os próximos testes do describe não contarem a mais
    await ta.contact.delete({ where: { id: created.id } });
  });

  it("upsert com id da outra conta não vaza (conflito de id)", async () => {
    await expect(
      ta.deal.upsert({
        where: { id: b.deal.id },
        create: {
          id: b.deal.id,
          accountId: b.account.id,
          title: "upsert forjado",
          stageId: a.stage.id,
          contactId: a.contact.id,
          ownerId: a.user.id,
        },
        update: { title: "upsert hack" },
      }),
    ).rejects.toThrow();

    const bDeal = await prismaBase.deal.findUnique({ where: { id: b.deal.id } });
    expect(bDeal?.title).toBe("Negócio b");
  });

  it("transação interativa mantém o isolamento", async () => {
    const accountIds = await ta.$transaction(async (tx) => {
      const contacts = await tx.contact.findMany();
      return contacts.map((contact) => contact.accountId);
    });
    expect(accountIds).toEqual([a.account.id]);

    await expect(
      ta.$transaction(async (tx) =>
        tx.contact.update({ where: { id: b.contact.id }, data: { name: "hack" } }),
      ),
    ).rejects.toThrow();
  });

  it("schema igual, dados diferentes: B só vê B", async () => {
    const rows = await tb.contact.findMany();
    expect(rows.length).toBe(1);
    expect(rows[0].accountId).toBe(b.account.id);
    await expect(tb.contact.findUnique({ where: { id: a.contact.id } })).resolves.toBeNull();
  });

  it("Account: só a própria conta; create/delete exigem o client de sistema", async () => {
    const accounts = await ta.account.findMany();
    expect(accounts.map((account) => account.id)).toEqual([a.account.id]);

    await expect(ta.account.findUnique({ where: { id: b.account.id } })).rejects.toThrow(
      TenantIsolationError,
    );
    await expect(ta.account.create({ data: { name: "conta nova" } })).rejects.toThrow(
      TenantIsolationError,
    );
    await expect(ta.account.delete({ where: { id: a.account.id } })).rejects.toThrow(
      TenantIsolationError,
    );
  });

  it("tenantDb() exige contexto de request e reusa o client do contexto", async () => {
    expect(getTenantContext()).toBeUndefined();
    expect(() => tenantDb()).toThrow(TenantContextMissingError);

    const count = await runWithTenant({ accountId: a.account.id }, async () => {
      const db = tenantDb();
      expect(db).toBe(tenantDb()); // mesmo client dentro do mesmo request
      return db.contact.count();
    });
    expect(count).toBe(1);
  });
});
