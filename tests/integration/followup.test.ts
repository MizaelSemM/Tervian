// Suíte do motor de follow-up e tela "Hoje" (007) — banco real.
//
// Cobre a fila por fuso/dia, recorte por papel, conclusão com próxima ação,
// fechamento ganho/perdido preservando a tarefa concluída e volume de 200
// tarefas. Cria contas isoladas e limpa tudo no final.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prismaBase } from "@/lib/prisma";
import { runWithTenant } from "@/lib/tenant-context";
import { createDeal } from "@/server/services/deals";
import { completeTask, getToday } from "@/server/services/followup";
import { listLostReasons } from "@/server/services/lost-reasons";
import { ensureDefaultPipeline, type StageRef } from "@/server/services/pipeline";

const run = Math.random().toString(36).slice(2, 8);
const accountIds: string[] = [];
let phoneSeq = 0;

const NOW = new Date("2026-10-30T15:00:00.000Z"); // 12:00 em São Paulo
const YESTERDAY_9 = new Date("2026-10-29T12:00:00.000Z");
const TODAY_9 = new Date("2026-10-30T12:00:00.000Z");
const TODAY_10 = new Date("2026-10-30T13:00:00.000Z");
const TOMORROW_9 = new Date("2026-10-31T12:00:00.000Z");
const NEXT_WEEK_9 = new Date("2026-11-02T12:00:00.000Z");

type Seeded = {
  accountId: string;
  admin: { id: string; name: string };
  sellerA: { id: string; name: string };
  sellerB: { id: string; name: string };
  stages: StageRef[];
};

type Role = "admin" | "sellerA" | "sellerB";

type DealWithTask = {
  contactId: string;
  dealId: string;
  taskId: string;
};

function nextPhone(): string {
  phoneSeq += 1;
  return `+551197654${String(phoneSeq).padStart(4, "0")}`;
}

async function makeSeeded(tag: string): Promise<Seeded> {
  const account = await prismaBase.account.create({
    data: { name: `[teste 007 ${tag}] ${run}` },
  });
  accountIds.push(account.id);

  const admin = await prismaBase.user.create({
    data: {
      accountId: account.id,
      name: `Admin ${tag}`,
      email: `followup-admin-${tag}-${run}@teste.tervian.dev`,
      role: "ADMIN",
    },
    select: { id: true, name: true },
  });
  const sellerA = await prismaBase.user.create({
    data: {
      accountId: account.id,
      name: `Vendedor A ${tag}`,
      email: `followup-seller-a-${tag}-${run}@teste.tervian.dev`,
      role: "SELLER",
    },
    select: { id: true, name: true },
  });
  const sellerB = await prismaBase.user.create({
    data: {
      accountId: account.id,
      name: `Vendedor B ${tag}`,
      email: `followup-seller-b-${tag}-${run}@teste.tervian.dev`,
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

async function makeDealWithTask(
  seeded: Seeded,
  options: {
    contactName: string;
    title: string;
    value: number | null;
    ownerId: string;
    nextActionAt: Date;
  },
): Promise<DealWithTask> {
  const contact = await makeContact(seeded, options.contactName, options.ownerId);
  const created = await as(seeded, "admin", () =>
    createDeal({
      actingUser: acting(seeded, "admin"),
      contactId: contact.id,
      title: options.title,
      value: options.value,
      ownerId: options.ownerId,
      nextActionAt: options.nextActionAt,
    }),
  );

  const task = await prismaBase.task.findFirstOrThrow({
    where: { accountId: seeded.accountId, dealId: created.dealId, completedAt: null },
    select: { id: true },
  });

  return { contactId: contact.id, dealId: created.dealId, taskId: task.id };
}

async function createExtraTask(seeded: Seeded, dealId: string, ownerId: string, title: string) {
  return prismaBase.task.create({
    data: {
      accountId: seeded.accountId,
      dealId,
      ownerId,
      type: "OTHER",
      title,
      dueAt: TODAY_9,
    },
    select: { id: true },
  });
}

let read: Seeded;
let write: Seeded;
let perf: Seeded;

let readOverdueA: DealWithTask;
let readTodayA: DealWithTask;
let readTodayB: DealWithTask;
let readTomorrowA: DealWithTask;
let readCompletedA: DealWithTask;
let readClosedA: DealWithTask;

beforeAll(async () => {
  read = await makeSeeded("read");
  write = await makeSeeded("write");
  perf = await makeSeeded("perf");

  readOverdueA = await makeDealWithTask(read, {
    contactName: "Contato Atrasado",
    title: "Negócio atrasado A",
    value: 100,
    ownerId: read.sellerA.id,
    nextActionAt: YESTERDAY_9,
  });
  readTodayA = await makeDealWithTask(read, {
    contactName: "Contato Hoje A",
    title: "Negócio hoje A",
    value: 200,
    ownerId: read.sellerA.id,
    nextActionAt: TODAY_9,
  });
  readTodayB = await makeDealWithTask(read, {
    contactName: "Contato Hoje B",
    title: "Negócio hoje B",
    value: 300,
    ownerId: read.sellerB.id,
    nextActionAt: TODAY_10,
  });
  readTomorrowA = await makeDealWithTask(read, {
    contactName: "Contato Amanhã A",
    title: "Negócio amanhã A",
    value: 400,
    ownerId: read.sellerA.id,
    nextActionAt: TOMORROW_9,
  });
  readCompletedA = await makeDealWithTask(read, {
    contactName: "Contato Concluído",
    title: "Negócio concluído A",
    value: 500,
    ownerId: read.sellerA.id,
    nextActionAt: TODAY_9,
  });
  readClosedA = await makeDealWithTask(read, {
    contactName: "Contato Fechado",
    title: "Negócio fechado A",
    value: 600,
    ownerId: read.sellerA.id,
    nextActionAt: TODAY_9,
  });

  await prismaBase.task.update({
    where: { id: readCompletedA.taskId },
    data: {
      completedAt: new Date("2026-10-30T14:00:00.000Z"),
      result: "ANSWERED",
    },
  });
  await prismaBase.deal.update({
    where: { id: readClosedA.dealId },
    data: { status: "WON", closedAt: NOW, nextActionAt: null },
  });
}, 120_000);

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

describe("getToday (integração)", () => {
  it("separa atrasadas e hoje, ignora amanhã/concluídas/fechadas e calcula contadores", async () => {
    const view = await as(read, "sellerA", () =>
      getToday({ actingUser: acting(read, "sellerA"), now: NOW }),
    );

    expect(view.overdue.map((task) => task.dealId)).toEqual([readOverdueA.dealId]);
    expect(view.today.map((task) => task.dealId)).toEqual([readTodayA.dealId]);
    expect(view.counts).toEqual({ overdue: 1, today: 1, completedToday: 1 });
    expect(view.sellers).toEqual([{ id: read.sellerA.id, name: read.sellerA.name }]);
    expect(view.ownerFilter).toBeNull();
    expect(view.todayLabel).toContain("Sexta-feira");

    expect(view.overdue[0]).toMatchObject({
      id: readOverdueA.taskId,
      contactName: "Contato Atrasado",
      dealTitle: "Negócio atrasado A",
      dealValue: 100,
      stageName: read.stages[0].name,
      dueTimeLabel: "09:00",
      overdueDays: 1,
      ownerId: read.sellerA.id,
      ownerName: read.sellerA.name,
    });
    expect(view.today[0]).toMatchObject({
      id: readTodayA.taskId,
      dueTimeLabel: "09:00",
      overdueDays: 0,
    });
    expect(view.today.map((task) => task.dealId)).not.toContain(readTomorrowA.dealId);
    expect(view.today.map((task) => task.dealId)).not.toContain(readCompletedA.dealId);
    expect(view.today.map((task) => task.dealId)).not.toContain(readClosedA.dealId);
  }, 20_000);

  it("vendedor B vê apenas as próprias tarefas", async () => {
    const view = await as(read, "sellerB", () =>
      getToday({ actingUser: acting(read, "sellerB"), now: NOW }),
    );

    expect(view.overdue).toHaveLength(0);
    expect(view.today.map((task) => task.dealId)).toEqual([readTodayB.dealId]);
    expect(view.counts).toEqual({ overdue: 0, today: 1, completedToday: 0 });
  }, 20_000);

  it("admin vê toda a equipe por padrão e pode filtrar por vendedor", async () => {
    const all = await as(read, "admin", () =>
      getToday({ actingUser: acting(read, "admin"), now: NOW }),
    );
    expect(all.overdue.map((task) => task.dealId)).toEqual([readOverdueA.dealId]);
    expect(all.today.map((task) => task.dealId).sort()).toEqual(
      [readTodayA.dealId, readTodayB.dealId].sort(),
    );
    expect(all.counts).toEqual({ overdue: 1, today: 2, completedToday: 1 });
    expect(all.ownerFilter).toBeNull();
    expect(all.sellers.some((seller) => seller.id === read.sellerA.id)).toBe(true);
    expect(all.sellers.some((seller) => seller.id === read.sellerB.id)).toBe(true);

    const filtered = await as(read, "admin", () =>
      getToday({
        actingUser: acting(read, "admin"),
        ownerId: read.sellerB.id,
        now: NOW,
      }),
    );
    expect(filtered.ownerFilter).toBe(read.sellerB.id);
    expect(filtered.overdue).toHaveLength(0);
    expect(filtered.today.map((task) => task.dealId)).toEqual([readTodayB.dealId]);
    expect(filtered.counts).toEqual({ overdue: 0, today: 1, completedToday: 0 });

    const invalid = await as(read, "admin", () =>
      getToday({
        actingUser: acting(read, "admin"),
        ownerId: "usuario-inexistente",
        now: NOW,
      }),
    );
    expect(invalid.ownerFilter).toBeNull();
    expect(invalid.counts.today).toBe(2);
  }, 20_000);

  it("carrega 200 tarefas em menos de 2s (smoke de escala)", async () => {
    const deal = await makeDealWithTask(perf, {
      contactName: "Contato Volume",
      title: "Negócio volume",
      value: 1000,
      ownerId: perf.sellerA.id,
      nextActionAt: TODAY_9,
    });

    await prismaBase.task.createMany({
      data: Array.from({ length: 199 }, (_, index) => ({
        accountId: perf.accountId,
        dealId: deal.dealId,
        ownerId: perf.sellerA.id,
        type: "OTHER" as const,
        title: `Tarefa volume ${index + 2}`,
        dueAt: TODAY_9,
      })),
    });

    const startedAt = performance.now();
    const view = await as(perf, "sellerA", () =>
      getToday({ actingUser: acting(perf, "sellerA"), now: NOW }),
    );
    const elapsed = performance.now() - startedAt;

    expect(view.today).toHaveLength(200);
    expect(view.counts.today).toBe(200);
    expect(elapsed).toBeLessThan(2000);
  }, 30_000);
});

describe("completeTask (integração)", () => {
  it("conclui com próximo follow-up e mantém tarefa/negócio sincronizados", async () => {
    const deal = await makeDealWithTask(write, {
      contactName: "Contato Follow-up",
      title: "Negócio follow-up",
      value: 1200,
      ownerId: write.sellerA.id,
      nextActionAt: TODAY_9,
    });

    const result = await as(write, "sellerA", () =>
      completeTask({
        taskId: deal.taskId,
        actingUser: acting(write, "sellerA"),
        result: "ANSWERED",
        resultNote: "Cliente pediu retorno",
        nextActionDate: "2026-11-02",
        now: NOW,
      }),
    );

    expect(result).toMatchObject({
      taskId: deal.taskId,
      dealId: deal.dealId,
      contactId: deal.contactId,
      closed: false,
    });

    const completed = await prismaBase.task.findUniqueOrThrow({ where: { id: deal.taskId } });
    expect(completed.completedAt?.toISOString()).toBe(NOW.toISOString());
    expect(completed.result).toBe("ANSWERED");
    expect(completed.resultNote).toBe("Cliente pediu retorno");

    const openTasks = await prismaBase.task.findMany({
      where: { accountId: write.accountId, dealId: deal.dealId, completedAt: null },
    });
    expect(openTasks).toHaveLength(1);
    expect(openTasks[0].dueAt.toISOString()).toBe(NEXT_WEEK_9.toISOString());
    expect(openTasks[0].title).toBe("Follow-up");
    expect(openTasks[0].ownerId).toBe(write.sellerA.id);

    const updatedDeal = await prismaBase.deal.findUniqueOrThrow({ where: { id: deal.dealId } });
    expect(updatedDeal.nextActionAt?.toISOString()).toBe(NEXT_WEEK_9.toISOString());

    const latestEvent = await prismaBase.timelineEvent.findFirstOrThrow({
      where: { dealId: deal.dealId },
      orderBy: { createdAt: "desc" },
    });
    expect(updatedDeal.lastActivityAt?.getTime()).toBe(latestEvent.createdAt.getTime());

    const events = await prismaBase.timelineEvent.findMany({
      where: { dealId: deal.dealId },
      select: { type: true },
    });
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["task.completed", "deal.next_action_changed"]),
    );
  }, 20_000);

  it("não conclui sem próxima ação e não altera nada", async () => {
    const deal = await makeDealWithTask(write, {
      contactName: "Contato Sem Data",
      title: "Negócio sem data",
      value: 300,
      ownerId: write.sellerA.id,
      nextActionAt: TODAY_9,
    });

    await expect(
      as(write, "sellerA", () =>
        completeTask({
          taskId: deal.taskId,
          actingUser: acting(write, "sellerA"),
          result: "ANSWERED",
          now: NOW,
        }),
      ),
    ).rejects.toMatchObject({ code: "TASK_NEXT_ACTION_REQUIRED" });

    const task = await prismaBase.task.findUniqueOrThrow({ where: { id: deal.taskId } });
    expect(task.completedAt).toBeNull();
    const unchanged = await prismaBase.deal.findUniqueOrThrow({ where: { id: deal.dealId } });
    expect(unchanged.nextActionAt?.toISOString()).toBe(TODAY_9.toISOString());
  }, 20_000);

  it("usa o título e o horário de retorno combinado em CALLBACK", async () => {
    const deal = await makeDealWithTask(write, {
      contactName: "Contato Callback",
      title: "Negócio callback",
      value: 800,
      ownerId: write.sellerA.id,
      nextActionAt: TODAY_9,
    });

    await as(write, "sellerA", () =>
      completeTask({
        taskId: deal.taskId,
        actingUser: acting(write, "sellerA"),
        result: "CALLBACK",
        nextActionDate: "2026-11-02",
        now: NOW,
      }),
    );

    const nextTask = await prismaBase.task.findFirstOrThrow({
      where: { dealId: deal.dealId, completedAt: null },
    });
    expect(nextTask.title).toBe("Retorno combinado");
    expect(nextTask.dueAt.toISOString()).toBe(NEXT_WEEK_9.toISOString());
  }, 20_000);

  it("vendedor não conclui tarefa de outro vendedor", async () => {
    const deal = await makeDealWithTask(write, {
      contactName: "Contato Protegido",
      title: "Negócio protegido",
      value: 500,
      ownerId: write.sellerA.id,
      nextActionAt: TODAY_9,
    });

    await expect(
      as(write, "sellerB", () =>
        completeTask({
          taskId: deal.taskId,
          actingUser: acting(write, "sellerB"),
          result: "ANSWERED",
          nextActionDate: "2026-11-02",
          now: NOW,
        }),
      ),
    ).rejects.toMatchObject({ code: "TASK_NOT_FOUND" });

    const task = await prismaBase.task.findUniqueOrThrow({ where: { id: deal.taskId } });
    expect(task.completedAt).toBeNull();
  }, 20_000);

  it("ganho preserva a tarefa concluída, cancela as demais e fecha o negócio", async () => {
    const deal = await makeDealWithTask(write, {
      contactName: "Contato Ganho",
      title: "Negócio ganho",
      value: 100,
      ownerId: write.sellerA.id,
      nextActionAt: TODAY_9,
    });
    const extraTask = await createExtraTask(
      write,
      deal.dealId,
      write.sellerA.id,
      "Tarefa duplicada",
    );

    const result = await as(write, "sellerA", () =>
      completeTask({
        taskId: deal.taskId,
        actingUser: acting(write, "sellerA"),
        result: "WON",
        wonValue: 250,
        now: NOW,
      }),
    );
    expect(result.closed).toBe(true);

    const updatedDeal = await prismaBase.deal.findUniqueOrThrow({ where: { id: deal.dealId } });
    expect(updatedDeal.status).toBe("WON");
    expect(Number(updatedDeal.value)).toBe(250);
    expect(updatedDeal.nextActionAt).toBeNull();
    expect(updatedDeal.closedAt?.toISOString()).toBe(NOW.toISOString());

    const completed = await prismaBase.task.findUniqueOrThrow({ where: { id: deal.taskId } });
    expect(completed.completedAt?.toISOString()).toBe(NOW.toISOString());
    expect(completed.result).toBe("WON");
    await expect(prismaBase.task.findUnique({ where: { id: extraTask.id } })).resolves.toBeNull();

    const closedEvent = await prismaBase.timelineEvent.findFirst({
      where: { dealId: deal.dealId, type: "deal.closed" },
    });
    expect(closedEvent).not.toBeNull();
  }, 20_000);

  it("ganho sem valor no negócio exige valor final e faz rollback da tarefa", async () => {
    const deal = await makeDealWithTask(write, {
      contactName: "Contato Sem Valor",
      title: "Negócio sem valor",
      value: null,
      ownerId: write.sellerA.id,
      nextActionAt: TODAY_9,
    });

    await expect(
      as(write, "sellerA", () =>
        completeTask({
          taskId: deal.taskId,
          actingUser: acting(write, "sellerA"),
          result: "WON",
          now: NOW,
        }),
      ),
    ).rejects.toMatchObject({ code: "DEAL_VALUE_REQUIRED" });

    const task = await prismaBase.task.findUniqueOrThrow({ where: { id: deal.taskId } });
    expect(task.completedAt).toBeNull();
    const unchanged = await prismaBase.deal.findUniqueOrThrow({ where: { id: deal.dealId } });
    expect(unchanged.status).toBe("OPEN");
  }, 20_000);

  it("perdido exige motivo e preserva a tarefa concluída", async () => {
    const deal = await makeDealWithTask(write, {
      contactName: "Contato Perdido",
      title: "Negócio perdido",
      value: 900,
      ownerId: write.sellerA.id,
      nextActionAt: TODAY_9,
    });

    await expect(
      as(write, "sellerA", () =>
        completeTask({
          taskId: deal.taskId,
          actingUser: acting(write, "sellerA"),
          result: "LOST",
          now: NOW,
        }),
      ),
    ).rejects.toMatchObject({ code: "DEAL_LOST_REASON_REQUIRED" });

    const reasons = await as(write, "sellerA", () => listLostReasons());
    expect(reasons.length).toBeGreaterThan(0);

    await as(write, "sellerA", () =>
      completeTask({
        taskId: deal.taskId,
        actingUser: acting(write, "sellerA"),
        result: "LOST",
        lostReasonId: reasons[0].id,
        lostNote: "Sem retorno",
        now: NOW,
      }),
    );

    const updatedDeal = await prismaBase.deal.findUniqueOrThrow({ where: { id: deal.dealId } });
    expect(updatedDeal.status).toBe("LOST");
    expect(updatedDeal.nextActionAt).toBeNull();
    expect(updatedDeal.lostReasonId).toBe(reasons[0].id);

    const completed = await prismaBase.task.findUniqueOrThrow({ where: { id: deal.taskId } });
    expect(completed.result).toBe("LOST");
    expect(completed.completedAt?.toISOString()).toBe(NOW.toISOString());
    const openTasks = await prismaBase.task.count({
      where: { dealId: deal.dealId, completedAt: null },
    });
    expect(openTasks).toBe(0);
  }, 20_000);

  it("rejeita conclusão repetida da mesma tarefa", async () => {
    const deal = await makeDealWithTask(write, {
      contactName: "Contato Repetido",
      title: "Negócio repetido",
      value: 700,
      ownerId: write.sellerA.id,
      nextActionAt: TODAY_9,
    });

    await as(write, "sellerA", () =>
      completeTask({
        taskId: deal.taskId,
        actingUser: acting(write, "sellerA"),
        result: "NO_ANSWER",
        nextActionDate: "2026-11-02",
        now: NOW,
      }),
    );

    await expect(
      as(write, "sellerA", () =>
        completeTask({
          taskId: deal.taskId,
          actingUser: acting(write, "sellerA"),
          result: "ANSWERED",
          nextActionDate: "2026-11-03",
          now: NOW,
        }),
      ),
    ).rejects.toMatchObject({ code: "TASK_ALREADY_COMPLETED" });
  }, 20_000);
});
