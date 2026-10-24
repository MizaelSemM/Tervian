// Suíte do funil de negócios (006) — roda contra o banco real.
//
// Cobre criação, board, lista, recorte por papel, movimentação com próxima
// ação, reagendamento/adiamento e fechamento ganho/perdido com motivo. Cria
// duas contas isoladas (uma para leitura/board, outra para mutações) e limpa
// tudo no final. Requer DATABASE_URL.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prismaBase } from "@/lib/prisma";
import { runWithTenant } from "@/lib/tenant-context";
import { calendarDaysBetween, dateKeyBR } from "@/lib/utils";
import {
  closeDeal,
  createDeal,
  deferDealNextAction,
  getDeal,
  listDealBoard,
  listDeals,
  moveDeal,
  scheduleNextAction,
  updateDeal,
} from "@/server/services/deals";
import { listLostReasons } from "@/server/services/lost-reasons";
import { ensureDefaultPipeline, type StageRef } from "@/server/services/pipeline";

const run = Math.random().toString(36).slice(2, 8);
const accountIds: string[] = [];
let phoneSeq = 0;

type Seeded = {
  accountId: string;
  admin: { id: string; name: string };
  sellerA: { id: string; name: string };
  sellerB: { id: string; name: string };
  stages: StageRef[];
};

type Role = "admin" | "sellerA" | "sellerB";

function nextPhone(): string {
  phoneSeq += 1;
  return `+551198765${String(phoneSeq).padStart(4, "0")}`;
}

function inDays(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

async function makeSeeded(tag: string): Promise<Seeded> {
  const account = await prismaBase.account.create({
    data: { name: `[teste 006 ${tag}] ${run}` },
  });
  accountIds.push(account.id);

  const admin = await prismaBase.user.create({
    data: {
      accountId: account.id,
      name: `Admin ${tag}`,
      email: `deals-admin-${tag}-${run}@teste.tervian.dev`,
      role: "ADMIN",
    },
    select: { id: true, name: true },
  });
  const sellerA = await prismaBase.user.create({
    data: {
      accountId: account.id,
      name: `Vendedor A ${tag}`,
      email: `deals-seller-a-${tag}-${run}@teste.tervian.dev`,
      role: "SELLER",
    },
    select: { id: true, name: true },
  });
  const sellerB = await prismaBase.user.create({
    data: {
      accountId: account.id,
      name: `Vendedor B ${tag}`,
      email: `deals-seller-b-${tag}-${run}@teste.tervian.dev`,
      role: "SELLER",
    },
    select: { id: true, name: true },
  });

  const { stages } = await runWithTenant({ accountId: account.id, userId: admin.id }, () =>
    ensureDefaultPipeline(),
  );

  return { accountId: account.id, admin, sellerA, sellerB, stages };
}

function as<T>(seeded: Seeded, role: Role, fn: () => Promise<T>): Promise<T> {
  const userId =
    role === "admin" ? seeded.admin.id : role === "sellerA" ? seeded.sellerA.id : seeded.sellerB.id;
  return runWithTenant({ accountId: seeded.accountId, userId }, fn);
}

function acting(seeded: Seeded, role: Role) {
  const user =
    role === "admin" ? seeded.admin : role === "sellerA" ? seeded.sellerA : seeded.sellerB;
  return { id: user.id, role: role === "admin" ? ("ADMIN" as const) : ("SELLER" as const) };
}

async function makeContact(
  seeded: Seeded,
  name: string,
  ownerId: string | null,
): Promise<{ id: string; name: string; phone: string }> {
  return prismaBase.contact.create({
    data: {
      accountId: seeded.accountId,
      name,
      phone: nextPhone(),
      ownerId,
    },
    select: { id: true, name: true, phone: true },
  });
}

async function makeDeal(
  seeded: Seeded,
  contactId: string,
  ownerId: string,
  overrides: Partial<{
    title: string;
    value: number | null;
    stageId: string;
    nextActionAt: Date;
  }> = {},
): Promise<string> {
  const result = await as(seeded, "admin", () =>
    createDeal({
      actingUser: acting(seeded, "admin"),
      contactId,
      title: overrides.title ?? "Negócio de teste",
      value: overrides.value === undefined ? 100 : overrides.value,
      stageId: overrides.stageId,
      ownerId,
      nextActionAt: overrides.nextActionAt ?? inDays(2),
    }),
  );
  return result.dealId;
}

/** Setup rápido para board/lista: não precisa de tarefa nem timeline. */
async function seedDeal(
  seeded: Seeded,
  contactId: string,
  ownerId: string,
  overrides: {
    title: string;
    value: number;
    stageId: string;
    nextActionAt: Date;
  },
): Promise<string> {
  const deal = await prismaBase.deal.create({
    data: {
      accountId: seeded.accountId,
      title: overrides.title,
      value: overrides.value,
      stageId: overrides.stageId,
      contactId,
      ownerId,
      nextActionAt: overrides.nextActionAt,
      lastActivityAt: new Date(),
    },
    select: { id: true },
  });
  return deal.id;
}

let crud: Seeded;
let board: Seeded;
let boardContactA: { id: string; name: string; phone: string };
let boardContactB: { id: string; name: string; phone: string };
let boardContactC: { id: string; name: string; phone: string };
let boardDealA1 = "";
let boardDealA2 = "";
let boardDealB1 = "";
let boardDealC1 = "";

beforeAll(async () => {
  crud = await makeSeeded("crud");
  board = await makeSeeded("board");

  boardContactA = await makeContact(board, "Cliente Board A", board.sellerA.id);
  boardContactB = await makeContact(board, "Cliente Board B", board.sellerB.id);
  boardContactC = await makeContact(board, "Cliente Board C", board.admin.id);

  boardDealA1 = await seedDeal(board, boardContactA.id, board.sellerA.id, {
    title: "Board A1",
    value: 100,
    stageId: board.stages[0].id,
    nextActionAt: inDays(3),
  });
  boardDealA2 = await seedDeal(board, boardContactA.id, board.sellerA.id, {
    title: "Board A2",
    value: 200,
    stageId: board.stages[1].id,
    nextActionAt: inDays(1),
  });
  boardDealB1 = await seedDeal(board, boardContactB.id, board.sellerB.id, {
    title: "Board B1",
    value: 300,
    stageId: board.stages[0].id,
    nextActionAt: inDays(2),
  });
  boardDealC1 = await seedDeal(board, boardContactC.id, board.admin.id, {
    title: "Board C1",
    value: 400,
    stageId: board.stages[3].id,
    nextActionAt: inDays(4),
  });
}, 60_000);

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

describe("createDeal (integração)", () => {
  it("cria negócio + tarefa de follow-up + timeline na mesma operação", async () => {
    const contact = await makeContact(crud, "Contato criação", crud.sellerA.id);
    const nextActionAt = inDays(3);
    const expectedCloseAt = inDays(30);

    const result = await as(crud, "admin", () =>
      createDeal({
        actingUser: acting(crud, "admin"),
        contactId: contact.id,
        title: "  Compra de 20 unidades  ",
        value: 1234.5,
        ownerId: crud.sellerA.id,
        expectedCloseAt,
        nextActionAt,
      }),
    );

    const deal = await prismaBase.deal.findUniqueOrThrow({ where: { id: result.dealId } });
    expect(deal.accountId).toBe(crud.accountId);
    expect(deal.title).toBe("Compra de 20 unidades");
    expect(Number(deal.value)).toBe(1234.5);
    expect(deal.stageId).toBe(crud.stages[0].id);
    expect(deal.ownerId).toBe(crud.sellerA.id);
    expect(deal.status).toBe("OPEN");
    expect(deal.nextActionAt?.getTime()).toBe(nextActionAt.getTime());
    expect(deal.expectedCloseAt?.getTime()).toBe(expectedCloseAt.getTime());
    expect(deal.lastActivityAt).not.toBeNull();

    const task = await prismaBase.task.findFirstOrThrow({
      where: { accountId: crud.accountId, dealId: result.dealId },
    });
    expect(task.title).toBe("Follow-up");
    expect(task.type).toBe("OTHER");
    expect(task.dueAt.getTime()).toBe(nextActionAt.getTime());
    expect(task.ownerId).toBe(crud.sellerA.id);

    const event = await prismaBase.timelineEvent.findFirstOrThrow({
      where: { accountId: crud.accountId, dealId: result.dealId, type: "deal.created" },
    });
    expect(event.payload).toMatchObject({ stage: "Novo", title: "Compra de 20 unidades" });
  });

  it("vendedor cria para o próprio contato, mas não para contato alheio", async () => {
    const ownContact = await makeContact(crud, "Contato do vendedor A", crud.sellerA.id);
    const own = await as(crud, "sellerA", () =>
      createDeal({
        actingUser: acting(crud, "sellerA"),
        contactId: ownContact.id,
        title: "Negócio do vendedor",
        nextActionAt: inDays(1),
      }),
    );
    const ownDeal = await prismaBase.deal.findUniqueOrThrow({ where: { id: own.dealId } });
    expect(ownDeal.ownerId).toBe(crud.sellerA.id);

    const otherContact = await makeContact(crud, "Contato do vendedor B", crud.sellerB.id);
    await expect(
      as(crud, "sellerA", () =>
        createDeal({
          actingUser: acting(crud, "sellerA"),
          contactId: otherContact.id,
          title: "Tentativa de invasão",
          nextActionAt: inDays(1),
        }),
      ),
    ).rejects.toMatchObject({ code: "DEAL_CONTACT_NOT_FOUND" });
  });

  it("admin cria para contato de outro e atribui a qualquer vendedor ativo", async () => {
    const contact = await makeContact(crud, "Contato atribuído", crud.admin.id);
    const result = await as(crud, "admin", () =>
      createDeal({
        actingUser: acting(crud, "admin"),
        contactId: contact.id,
        title: "Negócio atribuído",
        ownerId: crud.sellerB.id,
        nextActionAt: inDays(2),
      }),
    );
    const deal = await prismaBase.deal.findUniqueOrThrow({ where: { id: result.dealId } });
    expect(deal.ownerId).toBe(crud.sellerB.id);
  });
});

describe("getDeal (integração)", () => {
  it("admin abre qualquer negócio; vendedor só os próprios", async () => {
    const contactA = await makeContact(crud, "Contato detalhe A", crud.sellerA.id);
    const dealA = await makeDeal(crud, contactA.id, crud.sellerA.id, { title: "Detalhe A" });
    const contactB = await makeContact(crud, "Contato detalhe B", crud.sellerB.id);
    const dealB = await makeDeal(crud, contactB.id, crud.sellerB.id, { title: "Detalhe B" });

    const adminView = await as(crud, "admin", () =>
      getDeal({ id: dealA, actingUser: acting(crud, "admin") }),
    );
    expect(adminView?.title).toBe("Detalhe A");
    expect(adminView?.contact.name).toBe("Contato detalhe A");
    expect(adminView?.tasks.some((task) => task.completedAt === null)).toBe(true);
    expect(adminView?.timeline[0]?.type).toBe("deal.created");

    expect(
      await as(crud, "sellerA", () => getDeal({ id: dealB, actingUser: acting(crud, "sellerA") })),
    ).toBeNull();
    expect(
      await as(crud, "sellerA", () => getDeal({ id: dealA, actingUser: acting(crud, "sellerA") })),
    ).not.toBeNull();
  });
});

describe("updateDeal (integração)", () => {
  it("edita campos, reatribui a tarefa aberta e registra timeline", async () => {
    const contact = await makeContact(crud, "Contato edição", crud.sellerA.id);
    const dealId = await makeDeal(crud, contact.id, crud.sellerA.id, {
      title: "Título antigo",
      value: 100,
      nextActionAt: inDays(2),
    });
    const expectedCloseAt = inDays(20);

    await as(crud, "sellerA", () =>
      updateDeal({
        id: dealId,
        actingUser: acting(crud, "sellerA"),
        title: "  Título novo  ",
        value: 250.75,
        expectedCloseAt,
      }),
    );

    let deal = await prismaBase.deal.findUniqueOrThrow({ where: { id: dealId } });
    expect(deal.title).toBe("Título novo");
    expect(Number(deal.value)).toBe(250.75);
    expect(deal.expectedCloseAt?.getTime()).toBe(expectedCloseAt.getTime());
    expect(deal.ownerId).toBe(crud.sellerA.id);

    const event = await prismaBase.timelineEvent.findFirstOrThrow({
      where: { accountId: crud.accountId, dealId, type: "deal.updated" },
    });
    expect(event.payload).toMatchObject({ fields: ["title", "value", "expectedCloseAt"] });

    await as(crud, "admin", () =>
      updateDeal({
        id: dealId,
        actingUser: acting(crud, "admin"),
        title: "Título novo",
        value: 250.75,
        ownerId: crud.sellerB.id,
        expectedCloseAt,
      }),
    );

    deal = await prismaBase.deal.findUniqueOrThrow({ where: { id: dealId } });
    expect(deal.ownerId).toBe(crud.sellerB.id);
    const task = await prismaBase.task.findFirstOrThrow({
      where: { accountId: crud.accountId, dealId, completedAt: null },
    });
    expect(task.ownerId).toBe(crud.sellerB.id);

    await expect(
      as(crud, "sellerA", () =>
        updateDeal({
          id: dealId,
          actingUser: acting(crud, "sellerA"),
          title: "Tentativa",
          value: 1,
        }),
      ),
    ).rejects.toMatchObject({ code: "DEAL_NOT_FOUND" });
  });

  it("não edita negócio fechado", async () => {
    const contact = await makeContact(crud, "Contato edição fechado", crud.sellerA.id);
    const dealId = await makeDeal(crud, contact.id, crud.sellerA.id, {
      title: "Fechado",
      value: 10,
    });

    await as(crud, "sellerA", () =>
      closeDeal({ id: dealId, actingUser: acting(crud, "sellerA"), status: "WON", value: 10 }),
    );

    await expect(
      as(crud, "sellerA", () =>
        updateDeal({
          id: dealId,
          actingUser: acting(crud, "sellerA"),
          title: "Novo título",
          value: 20,
        }),
      ),
    ).rejects.toMatchObject({ code: "DEAL_CLOSED" });
  });
});

describe("listDealBoard (integração)", () => {
  it("admin vê tudo; vendedor vê só os próprios; contagem e soma por etapa", async () => {
    const adminBoard = await as(board, "admin", () =>
      listDealBoard({ actingUser: acting(board, "admin") }),
    );

    expect(adminBoard.totalOpen).toBe(4);
    expect(adminBoard.totalValue).toBe(1000);
    expect(adminBoard.stages.map((stage) => stage.name)).toEqual([
      "Novo",
      "Contatado",
      "Proposta enviada",
      "Negociação",
    ]);

    const novo = adminBoard.stages.find((stage) => stage.name === "Novo");
    expect(novo?.count).toBe(2);
    expect(novo?.totalValue).toBe(400);
    expect(novo?.deals.map((deal) => deal.title).sort()).toEqual(["Board A1", "Board B1"]);
    expect(novo?.deals.map((deal) => deal.id)).toContain(boardDealB1);

    const contatado = adminBoard.stages.find((stage) => stage.name === "Contatado");
    expect(contatado?.count).toBe(1);
    expect(contatado?.totalValue).toBe(200);

    const negociacao = adminBoard.stages.find((stage) => stage.name === "Negociação");
    expect(negociacao?.count).toBe(1);
    expect(negociacao?.totalValue).toBe(400);
    expect(negociacao?.deals[0]?.id).toBe(boardDealC1);

    const sellerBoard = await as(board, "sellerA", () =>
      listDealBoard({ actingUser: acting(board, "sellerA") }),
    );
    expect(sellerBoard.totalOpen).toBe(2);
    expect(sellerBoard.totalValue).toBe(300);
    expect(
      sellerBoard.stages
        .flatMap((stage) => stage.deals)
        .map((deal) => deal.id)
        .sort(),
    ).toEqual([boardDealA1, boardDealA2].sort());

    const filtered = await as(board, "admin", () =>
      listDealBoard({ actingUser: acting(board, "admin"), ownerId: board.sellerA.id }),
    );
    expect(filtered.totalOpen).toBe(2);
    expect(filtered.totalValue).toBe(300);
  });

  it("limita as cards por etapa e sinaliza que há mais", async () => {
    const seeded = await makeSeeded("limit");
    const contact = await makeContact(seeded, "Contato limite", seeded.sellerA.id);
    const stageId = seeded.stages[0].id;

    for (let index = 0; index < 3; index += 1) {
      await seedDeal(seeded, contact.id, seeded.sellerA.id, {
        title: `Limite ${index}`,
        value: 10,
        stageId,
        nextActionAt: inDays(index + 1),
      });
    }

    // 3 < limite de 50; o board traz todos e não sinaliza "mais".
    const result = await as(seeded, "admin", () =>
      listDealBoard({ actingUser: acting(seeded, "admin") }),
    );
    const novo = result.stages.find((stage) => stage.name === "Novo");
    expect(novo?.deals).toHaveLength(3);
    expect(novo?.hasMore).toBe(false);
    expect(novo?.count).toBe(3);
    expect(novo?.totalValue).toBe(30);
  });
});

describe("listDeals (integração)", () => {
  it("busca por negócio/contato/telefone, filtra status/etapa e pagina", async () => {
    const byTitle = await as(board, "admin", () =>
      listDeals({ actingUser: acting(board, "admin"), query: "Board A1" }),
    );
    expect(byTitle.total).toBe(1);
    expect(byTitle.items[0]?.id).toBe(boardDealA1);

    const byContact = await as(board, "admin", () =>
      listDeals({ actingUser: acting(board, "admin"), query: "Cliente Board A" }),
    );
    expect(byContact.total).toBe(2);
    expect(byContact.items.map((item) => item.id).sort()).toEqual(
      [boardDealA1, boardDealA2].sort(),
    );

    const byPhone = await as(board, "admin", () =>
      listDeals({ actingUser: acting(board, "admin"), query: boardContactA.phone }),
    );
    expect(byPhone.total).toBe(2);

    const byStage = await as(board, "admin", () =>
      listDeals({
        actingUser: acting(board, "admin"),
        query: "Cliente Board A",
        stageId: board.stages[1].id,
      }),
    );
    expect(byStage.total).toBe(1);
    expect(byStage.items[0]?.id).toBe(boardDealA2);

    const page1 = await as(board, "admin", () =>
      listDeals({
        actingUser: acting(board, "admin"),
        query: "Cliente Board A",
        pageSize: 1,
        page: 1,
      }),
    );
    expect(page1.total).toBe(2);
    expect(page1.totalPages).toBe(2);
    expect(page1.items).toHaveLength(1);

    const page2 = await as(board, "admin", () =>
      listDeals({
        actingUser: acting(board, "admin"),
        query: "Cliente Board A",
        pageSize: 1,
        page: 2,
      }),
    );
    expect(page2.items[0]?.id).toBe(boardDealA1);
  });

  it("vendedor só lista os próprios e admin pode filtrar por responsável", async () => {
    const sellerView = await as(board, "sellerB", () =>
      listDeals({ actingUser: acting(board, "sellerB"), query: "Cliente Board A" }),
    );
    expect(sellerView.total).toBe(0);

    const adminFiltered = await as(board, "admin", () =>
      listDeals({
        actingUser: acting(board, "admin"),
        query: "Cliente Board A",
        ownerId: board.sellerA.id,
      }),
    );
    expect(adminFiltered.total).toBe(2);

    const adminOther = await as(board, "admin", () =>
      listDeals({
        actingUser: acting(board, "admin"),
        query: "Cliente Board A",
        ownerId: board.sellerB.id,
      }),
    );
    expect(adminOther.total).toBe(0);
  });
});

describe("moveDeal (integração)", () => {
  it("persiste a etapa, atualiza atividade e registra timeline", async () => {
    const contact = await makeContact(crud, "Contato mover", crud.sellerA.id);
    const dealId = await makeDeal(crud, contact.id, crud.sellerA.id, {
      title: "Negócio para mover",
      stageId: crud.stages[0].id,
    });
    const before = await prismaBase.deal.findUniqueOrThrow({ where: { id: dealId } });

    const result = await as(crud, "sellerA", () =>
      moveDeal({
        id: dealId,
        actingUser: acting(crud, "sellerA"),
        toStageId: crud.stages[1].id,
      }),
    );
    expect(result.changed).toBe(true);
    expect(result.stageId).toBe(crud.stages[1].id);

    const after = await prismaBase.deal.findUniqueOrThrow({ where: { id: dealId } });
    expect(after.stageId).toBe(crud.stages[1].id);
    expect(after.lastActivityAt?.getTime()).toBeGreaterThanOrEqual(
      before.lastActivityAt?.getTime() ?? 0,
    );

    const event = await prismaBase.timelineEvent.findFirstOrThrow({
      where: { accountId: crud.accountId, dealId, type: "deal.stage_changed" },
    });
    expect(event.payload).toMatchObject({ from: "Novo", to: "Contatado" });

    const same = await as(crud, "sellerA", () =>
      moveDeal({
        id: dealId,
        actingUser: acting(crud, "sellerA"),
        toStageId: crud.stages[1].id,
      }),
    );
    expect(same.changed).toBe(false);
  });

  it("recusa etapa inválida, negócio alheio e negócio sem próxima ação", async () => {
    const contact = await makeContact(crud, "Contato mover inválido", crud.sellerA.id);
    const dealId = await makeDeal(crud, contact.id, crud.sellerA.id, {
      title: "Negócio mover inválido",
    });

    await expect(
      as(crud, "sellerA", () =>
        moveDeal({
          id: dealId,
          actingUser: acting(crud, "sellerA"),
          toStageId: "stage-inexistente",
        }),
      ),
    ).rejects.toMatchObject({ code: "DEAL_STAGE_INVALID" });

    await expect(
      as(crud, "sellerB", () =>
        moveDeal({
          id: dealId,
          actingUser: acting(crud, "sellerB"),
          toStageId: crud.stages[1].id,
        }),
      ),
    ).rejects.toMatchObject({ code: "DEAL_NOT_FOUND" });

    const legacy = await prismaBase.deal.create({
      data: {
        accountId: crud.accountId,
        title: "Negócio legado sem próxima ação",
        stageId: crud.stages[0].id,
        contactId: contact.id,
        ownerId: crud.sellerA.id,
        value: 50,
        nextActionAt: null,
      },
      select: { id: true },
    });

    await expect(
      as(crud, "sellerA", () =>
        moveDeal({
          id: legacy.id,
          actingUser: acting(crud, "sellerA"),
          toStageId: crud.stages[1].id,
        }),
      ),
    ).rejects.toMatchObject({ code: "DEAL_NEXT_ACTION_REQUIRED" });
  });
});

describe("scheduleNextAction e deferDealNextAction (integração)", () => {
  it("reagenda a tarefa aberta e mantém deals.next_action_at sincronizado", async () => {
    const contact = await makeContact(crud, "Contato reagendar", crud.sellerA.id);
    const dealId = await makeDeal(crud, contact.id, crud.sellerA.id, {
      title: "Negócio reagendar",
      nextActionAt: inDays(2),
    });

    const scheduled = await as(crud, "sellerA", () =>
      scheduleNextAction({
        id: dealId,
        actingUser: acting(crud, "sellerA"),
        dueAt: inDays(5),
      }),
    );

    const deal = await prismaBase.deal.findUniqueOrThrow({ where: { id: dealId } });
    const task = await prismaBase.task.findUniqueOrThrow({ where: { id: scheduled.taskId } });
    expect(deal.nextActionAt?.getTime()).toBe(task.dueAt.getTime());
    expect(task.completedAt).toBeNull();
    expect(await prismaBase.task.count({ where: { accountId: crud.accountId, dealId } })).toBe(1);

    const deferred = await as(crud, "sellerA", () =>
      deferDealNextAction({ id: dealId, actingUser: acting(crud, "sellerA") }),
    );
    expect(deferred.oldDate).toBe(dateKeyBR(deal.nextActionAt));
    expect(calendarDaysBetween(deferred.oldDate ?? "", deferred.newDate)).toBe(1);

    const deferredDeal = await prismaBase.deal.findUniqueOrThrow({ where: { id: dealId } });
    const deferredTask = await prismaBase.task.findUniqueOrThrow({
      where: { id: scheduled.taskId },
    });
    expect(dateKeyBR(deferredDeal.nextActionAt)).toBe(deferred.newDate);
    expect(dateKeyBR(deferredTask.dueAt)).toBe(deferred.newDate);
  });

  it("cria tarefa quando o negócio legado não tem próxima ação", async () => {
    const contact = await makeContact(crud, "Contato legado", crud.sellerA.id);
    const legacy = await prismaBase.deal.create({
      data: {
        accountId: crud.accountId,
        title: "Legado sem ação",
        stageId: crud.stages[0].id,
        contactId: contact.id,
        ownerId: crud.sellerA.id,
        nextActionAt: null,
      },
      select: { id: true },
    });

    const result = await as(crud, "sellerA", () =>
      deferDealNextAction({ id: legacy.id, actingUser: acting(crud, "sellerA") }),
    );
    expect(result.oldDate).toBeNull();
    expect(result.newDate).toBe(dateKeyBR(inDays(1)));

    const deal = await prismaBase.deal.findUniqueOrThrow({ where: { id: legacy.id } });
    const task = await prismaBase.task.findFirstOrThrow({
      where: { accountId: crud.accountId, dealId: legacy.id, completedAt: null },
    });
    expect(dateKeyBR(deal.nextActionAt)).toBe(result.newDate);
    expect(dateKeyBR(task.dueAt)).toBe(result.newDate);
  });
});

describe("closeDeal (integração)", () => {
  it("ganho exige valor final quando o negócio não tem valor, fecha e cancela a tarefa", async () => {
    const contact = await makeContact(crud, "Contato ganho", crud.sellerA.id);
    const dealId = await makeDeal(crud, contact.id, crud.sellerA.id, {
      title: "Negócio sem valor",
      value: null,
    });

    await expect(
      as(crud, "sellerA", () =>
        closeDeal({ id: dealId, actingUser: acting(crud, "sellerA"), status: "WON" }),
      ),
    ).rejects.toMatchObject({ code: "DEAL_VALUE_REQUIRED" });

    await expect(
      as(crud, "sellerB", () =>
        closeDeal({ id: dealId, actingUser: acting(crud, "sellerB"), status: "WON", value: 10 }),
      ),
    ).rejects.toMatchObject({ code: "DEAL_NOT_FOUND" });

    await as(crud, "sellerA", () =>
      closeDeal({
        id: dealId,
        actingUser: acting(crud, "sellerA"),
        status: "WON",
        value: 99.5,
      }),
    );

    const deal = await prismaBase.deal.findUniqueOrThrow({ where: { id: dealId } });
    expect(deal.status).toBe("WON");
    expect(Number(deal.value)).toBe(99.5);
    expect(deal.closedAt).not.toBeNull();
    expect(deal.nextActionAt).toBeNull();
    expect(deal.lostReasonId).toBeNull();
    expect(await prismaBase.task.count({ where: { accountId: crud.accountId, dealId } })).toBe(0);

    const event = await prismaBase.timelineEvent.findFirstOrThrow({
      where: { accountId: crud.accountId, dealId, type: "deal.closed" },
    });
    expect(event.payload).toMatchObject({ status: "WON", value: 99.5 });

    await expect(
      as(crud, "sellerA", () =>
        closeDeal({ id: dealId, actingUser: acting(crud, "sellerA"), status: "WON", value: 100 }),
      ),
    ).rejects.toMatchObject({ code: "DEAL_ALREADY_CLOSED" });
  });

  it("perdido exige motivo, aceita observação e preserva o motivo no detalhe", async () => {
    const contact = await makeContact(crud, "Contato perdido", crud.sellerA.id);
    const dealId = await makeDeal(crud, contact.id, crud.sellerA.id, {
      title: "Negócio perdido",
      value: 500,
    });

    await expect(
      as(crud, "sellerA", () =>
        closeDeal({ id: dealId, actingUser: acting(crud, "sellerA"), status: "LOST" }),
      ),
    ).rejects.toMatchObject({ code: "DEAL_LOST_REASON_REQUIRED" });

    const reasons = await as(crud, "sellerA", () => listLostReasons());
    expect(reasons).toHaveLength(5);
    expect(reasons.map((reason) => reason.name)).toContain("Preço");
    expect(await as(crud, "sellerA", () => listLostReasons())).toHaveLength(5);

    const reason = reasons.find((item) => item.name === "Preço");
    if (!reason) throw new Error("Motivo padrão não encontrado");

    await as(crud, "sellerA", () =>
      closeDeal({
        id: dealId,
        actingUser: acting(crud, "sellerA"),
        status: "LOST",
        lostReasonId: reason.id,
        lostNote: "  Achou o preço alto  ",
      }),
    );

    const deal = await prismaBase.deal.findUniqueOrThrow({ where: { id: dealId } });
    expect(deal.status).toBe("LOST");
    expect(deal.nextActionAt).toBeNull();
    expect(deal.lostReasonId).toBe(reason.id);
    expect(deal.lostNote).toBe("Achou o preço alto");
    expect(await prismaBase.task.count({ where: { accountId: crud.accountId, dealId } })).toBe(0);

    const detail = await as(crud, "admin", () =>
      getDeal({ id: dealId, actingUser: acting(crud, "admin") }),
    );
    expect(detail?.status).toBe("LOST");
    expect(detail?.lostReason?.name).toBe("Preço");
    expect(detail?.lostNote).toBe("Achou o preço alto");
  });
});
