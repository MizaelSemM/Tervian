// Suíte de contatos (005) — lista/busca/paginação, edição e exclusão lógica.
//
// Roda contra o banco real; cria uma conta com 2 leads (um do admin, um do
// vendedor) e valida o recorte por papel. Limpa tudo no final. Requer
// DATABASE_URL.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prismaBase } from "@/lib/prisma";
import { runWithTenant } from "@/lib/tenant-context";
import {
  getContact,
  listContacts,
  softDeleteContact,
  updateContact,
} from "@/server/services/contacts";
import { createLead } from "@/server/services/leads";

const run = Math.random().toString(36).slice(2, 8);
const ANA_PHONE = "+5511987650001";
const BRUNO_PHONE = "+5511987650002";

let accountId = "";
let adminId = "";
let sellerId = "";
let anaId = "";
let brunoId = "";
let brunoOpenDealId = "";
let brunoWonDealId = "";

function asAdmin<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant({ accountId, userId: adminId }, fn);
}

function asSeller<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant({ accountId, userId: sellerId }, fn);
}

beforeAll(async () => {
  const account = await prismaBase.account.create({
    data: { name: `[teste 005 contatos] ${run}` },
  });
  accountId = account.id;

  const admin = await prismaBase.user.create({
    data: {
      accountId,
      name: "Admin Contatos",
      email: `contacts-admin-${run}@teste.tervian.dev`,
      role: "ADMIN",
    },
  });
  adminId = admin.id;

  const seller = await prismaBase.user.create({
    data: {
      accountId,
      name: "Vendedor Contatos",
      email: `contacts-seller-${run}@teste.tervian.dev`,
      role: "SELLER",
    },
  });
  sellerId = seller.id;

  const ana = await asAdmin(() =>
    createLead({
      actingUser: { id: adminId, role: "ADMIN" },
      name: "Ana Alpha",
      phone: "11987650001",
      companyText: "Alpha Ltda",
      origin: "INSTAGRAM",
    }),
  );
  expect(ana.status).toBe("created");
  if (ana.status !== "created") throw new Error("Falha ao semear Ana");
  anaId = ana.contactId;

  const bruno = await asAdmin(() =>
    createLead({
      actingUser: { id: adminId, role: "ADMIN" },
      name: "Bruno Beta",
      phone: "11987650002",
      companyText: "Beta Ltda",
      origin: "SITE",
      ownerId: sellerId,
    }),
  );
  expect(bruno.status).toBe("created");
  if (bruno.status !== "created") throw new Error("Falha ao semear Bruno");
  brunoId = bruno.contactId;
  brunoOpenDealId = bruno.dealId;

  // Negócio já fechado, para provar que a exclusão do contato não apaga histórico.
  const stage = await prismaBase.stage.findFirstOrThrow({
    where: { accountId, name: "Novo" },
    select: { id: true },
  });
  const wonDeal = await prismaBase.deal.create({
    data: {
      accountId,
      title: "Projeto fechado",
      stageId: stage.id,
      contactId: brunoId,
      ownerId: sellerId,
      status: "WON",
      closedAt: new Date(),
    },
    select: { id: true },
  });
  brunoWonDealId = wonDeal.id;
}, 30_000);

afterAll(async () => {
  try {
    if (accountId) {
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

describe("listContacts (integração)", () => {
  it("admin vê todos; vendedor vê só os próprios", async () => {
    const adminView = await asAdmin(() =>
      listContacts({ actingUser: { id: adminId, role: "ADMIN" } }),
    );
    expect(adminView.total).toBe(2);
    expect(adminView.items.map((contact) => contact.name)).toEqual(["Ana Alpha", "Bruno Beta"]);
    expect(adminView.items.map((contact) => contact.dealsCount)).toEqual([1, 2]);

    const sellerView = await asSeller(() =>
      listContacts({ actingUser: { id: sellerId, role: "SELLER" } }),
    );
    expect(sellerView.total).toBe(1);
    expect(sellerView.items[0]?.name).toBe("Bruno Beta");
  });

  it("busca por nome (sem caixa) e por telefone (com ou sem máscara)", async () => {
    const byName = await asAdmin(() =>
      listContacts({ actingUser: { id: adminId, role: "ADMIN" }, query: "ANA" }),
    );
    expect(byName.total).toBe(1);
    expect(byName.items[0]?.id).toBe(anaId);

    const byPartialPhone = await asAdmin(() =>
      listContacts({ actingUser: { id: adminId, role: "ADMIN" }, query: "98765" }),
    );
    expect(byPartialPhone.total).toBe(2);

    const byMaskedPhone = await asAdmin(() =>
      listContacts({ actingUser: { id: adminId, role: "ADMIN" }, query: "(11) 98765-0001" }),
    );
    expect(byMaskedPhone.total).toBe(1);
    expect(byMaskedPhone.items[0]?.phone).toBe(ANA_PHONE);
  });

  it("pagina a lista e limita o tamanho da página", async () => {
    const first = await asAdmin(() =>
      listContacts({ actingUser: { id: adminId, role: "ADMIN" }, pageSize: 1, page: 1 }),
    );
    expect(first.total).toBe(2);
    expect(first.totalPages).toBe(2);
    expect(first.items).toHaveLength(1);
    expect(first.items[0]?.name).toBe("Ana Alpha");

    const second = await asAdmin(() =>
      listContacts({ actingUser: { id: adminId, role: "ADMIN" }, pageSize: 1, page: 2 }),
    );
    expect(second.items[0]?.name).toBe("Bruno Beta");

    const clamped = await asAdmin(() =>
      listContacts({ actingUser: { id: adminId, role: "ADMIN" }, pageSize: 999, page: 0 }),
    );
    expect(clamped.page).toBe(1);
    expect(clamped.pageSize).toBe(50);

    const clampedHigh = await asAdmin(() =>
      listContacts({ actingUser: { id: adminId, role: "ADMIN" }, pageSize: 1, page: 99 }),
    );
    expect(clampedHigh.page).toBe(2);
    expect(clampedHigh.items[0]?.name).toBe("Bruno Beta");

    const empty = await asAdmin(() =>
      listContacts({ actingUser: { id: adminId, role: "ADMIN" }, query: "inexistente" }),
    );
    expect(empty.total).toBe(0);
    expect(empty.items).toEqual([]);
  });
});

describe("getContact e updateContact (integração)", () => {
  it("vendedor não abre contato de outro; admin abre com os negócios", async () => {
    const forbidden = await asSeller(() =>
      getContact({ id: anaId, actingUser: { id: sellerId, role: "SELLER" } }),
    );
    expect(forbidden).toBeNull();

    const detail = await asAdmin(() =>
      getContact({ id: anaId, actingUser: { id: adminId, role: "ADMIN" } }),
    );
    expect(detail?.name).toBe("Ana Alpha");
    expect(detail?.deals).toHaveLength(1);
    expect(detail?.deals[0]?.stageName).toBe("Novo");
    expect(detail?.deals[0]?.status).toBe("OPEN");
  });

  it("vendedor não edita contato de outro; edita o próprio", async () => {
    await expect(
      asSeller(() =>
        updateContact({
          id: anaId,
          actingUser: { id: sellerId, role: "SELLER" },
          name: "Hack",
          phone: "11987650001",
        }),
      ),
    ).rejects.toMatchObject({ code: "CONTACT_NOT_FOUND" });

    await asSeller(() =>
      updateContact({
        id: brunoId,
        actingUser: { id: sellerId, role: "SELLER" },
        name: "Bruno Beta Atualizado",
        phone: "(11) 98765-0002",
      }),
    );

    const bruno = await prismaBase.contact.findUniqueOrThrow({ where: { id: brunoId } });
    expect(bruno.name).toBe("Bruno Beta Atualizado");
    expect(bruno.phone).toBe(BRUNO_PHONE);
    // Atualização parcial não pode zerar campos que o vendedor nem vê no form.
    expect(bruno.companyText).toBe("Beta Ltda");
    expect(bruno.origin).toBe("SITE");
    expect(bruno.email).toBeNull();
  });

  it("admin edita, normaliza telefone e registra os campos alterados na timeline", async () => {
    await asAdmin(() =>
      updateContact({
        id: anaId,
        actingUser: { id: adminId, role: "ADMIN" },
        name: "Ana Alpha Silva",
        phone: "(11) 98888-0001",
        email: " ANA@ALPHA.COM ",
        companyText: "Alpha Ltda ME",
        origin: "REFERRAL",
        ownerId: sellerId,
      }),
    );

    const ana = await prismaBase.contact.findUniqueOrThrow({ where: { id: anaId } });
    expect(ana.name).toBe("Ana Alpha Silva");
    expect(ana.phone).toBe("+5511988880001");
    expect(ana.email).toBe("ana@alpha.com");
    expect(ana.companyText).toBe("Alpha Ltda ME");
    expect(ana.origin).toBe("REFERRAL");
    expect(ana.ownerId).toBe(sellerId);

    const event = await prismaBase.timelineEvent.findFirst({
      where: { accountId, contactId: anaId, type: "contact.updated" },
      orderBy: { createdAt: "desc" },
    });
    expect(event).not.toBeNull();
    expect(event?.payload).toMatchObject({
      fields: expect.arrayContaining([
        "name",
        "phone",
        "email",
        "companyText",
        "origin",
        "ownerId",
      ]),
    });
  });

  it("recusa telefone duplicado e telefone inválido", async () => {
    await expect(
      asAdmin(() =>
        updateContact({
          id: anaId,
          actingUser: { id: adminId, role: "ADMIN" },
          name: "Ana Alpha Silva",
          phone: BRUNO_PHONE,
        }),
      ),
    ).rejects.toMatchObject({ code: "CONTACT_PHONE_TAKEN" });

    await expect(
      asAdmin(() =>
        updateContact({
          id: anaId,
          actingUser: { id: adminId, role: "ADMIN" },
          name: "Ana Alpha Silva",
          phone: "1234",
        }),
      ),
    ).rejects.toMatchObject({ code: "CONTACT_PHONE_INVALID" });
  });
});

describe("softDeleteContact (integração)", () => {
  it("esconde o contato, fecha negócios abertos, cancela tarefas e preserva o histórico", async () => {
    const openTask = await prismaBase.task.findFirstOrThrow({
      where: { accountId, dealId: brunoOpenDealId, completedAt: null },
      select: { id: true },
    });

    await asSeller(() =>
      softDeleteContact({ id: brunoId, actingUser: { id: sellerId, role: "SELLER" } }),
    );

    const contact = await prismaBase.contact.findUniqueOrThrow({ where: { id: brunoId } });
    expect(contact.deletedAt).not.toBeNull();

    expect(await prismaBase.task.findUnique({ where: { id: openTask.id } })).toBeNull();

    const openDeal = await prismaBase.deal.findUniqueOrThrow({ where: { id: brunoOpenDealId } });
    expect(openDeal.deletedAt).not.toBeNull();
    expect(openDeal.nextActionAt).toBeNull();

    const wonDeal = await prismaBase.deal.findUniqueOrThrow({ where: { id: brunoWonDealId } });
    expect(wonDeal.deletedAt).toBeNull();

    const events = await prismaBase.timelineEvent.findMany({
      where: { accountId, contactId: brunoId, type: { in: ["contact.deleted", "deal.deleted"] } },
    });
    expect(events.map((event) => event.type).sort()).toEqual(["contact.deleted", "deal.deleted"]);

    const adminView = await asAdmin(() =>
      listContacts({ actingUser: { id: adminId, role: "ADMIN" } }),
    );
    expect(adminView.total).toBe(1);
    expect(adminView.items[0]?.id).toBe(anaId);

    expect(
      await asSeller(() =>
        getContact({ id: brunoId, actingUser: { id: sellerId, role: "SELLER" } }),
      ),
    ).toBeNull();
  });

  it("novo lead com telefone de contato excluído avisa e não recria", async () => {
    const result = await asAdmin(() =>
      createLead({
        actingUser: { id: adminId, role: "ADMIN" },
        name: "Bruno de Novo",
        phone: BRUNO_PHONE,
      }),
    );

    expect(result.status).toBe("duplicate");
    if (result.status !== "duplicate") return;
    expect(result.contact).toMatchObject({ id: brunoId, deleted: true });
    expect(await prismaBase.contact.count({ where: { accountId } })).toBe(2); // Ana + Bruno (excluído)
  });
});
