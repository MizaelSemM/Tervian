// Seed do Tervian — configuração inicial + dados de demonstração.
//
// Idempotente: usa IDs fixos com upsert; rodar de novo não duplica nada
// (e não sobrescreve edições feitas pelo usuário — update é vazio de propósito).
//
// Uso: npm run db:seed

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient } from "../lib/generated/prisma/client";
import { normalizePhoneBR } from "../lib/phone";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não está definida — confira o arquivo .env");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// ---------------------------------------------------------------- helpers

/** Data/hora local: `at(-1, 15, 30)` = ontem às 15:30. */
function at(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function requirePhone(masked: string): string {
  const e164 = normalizePhoneBR(masked);
  if (!e164) throw new Error(`Telefone inválido no seed: ${masked}`);
  return e164;
}

// ---------------------------------------------------------------- constantes

const ACCOUNT_ID = "demo-account";
const USERS = { admin: "demo-user-admin", seller: "demo-user-seller" } as const;

const STAGES = {
  new: "demo-stage-new",
  contacted: "demo-stage-contacted",
  proposal: "demo-stage-proposal",
  negotiation: "demo-stage-negotiation",
} as const;

const STAGE_NAMES: Record<keyof typeof STAGES, string> = {
  new: "Novo",
  contacted: "Contatado",
  proposal: "Proposta enviada",
  negotiation: "Negociação",
};

const LOST_REASONS: Record<string, string> = {
  Preço: "demo-lost-price",
  Concorrência: "demo-lost-competitor",
  "Sem resposta": "demo-lost-no-response",
  "Momento ruim": "demo-lost-timing",
  Outro: "demo-lost-other",
};

type Origin = "INSTAGRAM" | "REFERRAL" | "SITE" | "STORE" | "FORM" | "IMPORT" | "OTHER";
type TaskTypeSeed = "WHATSAPP" | "CALL" | "MEETING" | "OTHER";
type TaskResultSeed = "ANSWERED" | "NO_ANSWER" | "CALLBACK" | "WON" | "LOST";

type DealSeed = {
  n: number;
  contact: string;
  phone: string;
  email?: string;
  company?: string;
  tags?: string[];
  origin: Origin;
  title: string;
  value: number;
  stage: keyof typeof STAGES;
  owner: keyof typeof USERS;
  createdDaysAgo: number;
  lastActivityDaysAgo: number;
  expectedCloseInDays?: number;
  openTask?: { type: TaskTypeSeed; title: string; due: [number, number, number] };
  completedTask?: {
    type: TaskTypeSeed;
    title: string;
    completed: [number, number, number];
    result: TaskResultSeed;
    note?: string;
  };
  status?: "WON" | "LOST";
  lostReason?: string;
  lostNote?: string;
  closedDaysAgo?: number;
};

const DEALS: DealSeed[] = [
  {
    n: 1,
    contact: "Carla Mendes",
    phone: "(11) 99101-0001",
    email: "carla@lojacarla.com.br",
    company: "Loja da Carla",
    tags: ["vip"],
    origin: "INSTAGRAM",
    title: "Compra de 20 unidades",
    value: 1200,
    stage: "new",
    owner: "seller",
    createdDaysAgo: 3,
    lastActivityDaysAgo: 3,
    openTask: { type: "WHATSAPP", title: "Primeiro contato", due: [-1, 15, 0] },
  },
  {
    n: 2,
    contact: "Roberto Silva",
    phone: "(11) 99102-0002",
    email: "roberto.silva@outlook.com",
    company: "Silva & Filhos",
    origin: "REFERRAL",
    title: "Plano anual",
    value: 3400,
    stage: "contacted",
    owner: "admin",
    createdDaysAgo: 7,
    lastActivityDaysAgo: 1,
    openTask: {
      type: "CALL",
      title: "Ligar para apresentar valores",
      due: [0, 10, 0],
    },
  },
  {
    n: 3,
    contact: "Fernanda Costa",
    phone: "(21) 99103-0003",
    email: "fernanda@fcosta.com.br",
    company: "FCosta Interiores",
    origin: "SITE",
    title: "Site novo da loja",
    value: 8900,
    stage: "proposal",
    owner: "admin",
    createdDaysAgo: 9,
    lastActivityDaysAgo: 4,
    openTask: {
      type: "WHATSAPP",
      title: "Acompanhar proposta enviada",
      due: [0, 14, 0],
    },
  },
  {
    n: 4,
    contact: "João Pereira",
    phone: "(31) 99104-0004",
    email: "joaopereira@pedidosjp.com.br",
    company: "PedidosJP",
    origin: "STORE",
    title: "Sistema de pedidos",
    value: 12000,
    stage: "negotiation",
    owner: "seller",
    createdDaysAgo: 10,
    lastActivityDaysAgo: 6,
    openTask: { type: "CALL", title: "Fechar condições finais", due: [0, 16, 0] },
    completedTask: {
      type: "MEETING",
      title: "Reunião de descoberta",
      completed: [-6, 14, 0],
      result: "ANSWERED",
    },
  },
  {
    n: 5,
    contact: "Luiza Rocha",
    phone: "(41) 99105-0005",
    origin: "INSTAGRAM",
    title: "Consultoria 3 meses",
    value: 6500,
    stage: "contacted",
    owner: "admin",
    createdDaysAgo: 6,
    lastActivityDaysAgo: 6,
    openTask: { type: "MEETING", title: "Reunião de descoberta", due: [1, 9, 0] },
  },
  {
    n: 6,
    contact: "Pedro Alves",
    phone: "(51) 99106-0006",
    email: "pedro.alves@gmail.com",
    company: "Alves Distribuidora",
    origin: "FORM",
    title: "Licenças para 10 usuários",
    value: 2300,
    stage: "new",
    owner: "seller",
    createdDaysAgo: 2,
    lastActivityDaysAgo: 1,
    openTask: { type: "WHATSAPP", title: "Primeiro contato", due: [0, 11, 0] },
  },
  {
    n: 7,
    contact: "Marina Dias",
    phone: "(61) 99107-0007",
    origin: "REFERRAL",
    title: "Treinamento da equipe",
    value: 4800,
    stage: "proposal",
    owner: "admin",
    createdDaysAgo: 8,
    lastActivityDaysAgo: 3,
    openTask: {
      type: "CALL",
      title: "Retomar conversa sobre a proposta",
      due: [2, 10, 0],
    },
  },
  {
    n: 8,
    contact: "Thiago Nunes",
    phone: "(71) 99108-0008",
    email: "thiago@nuneslog.com.br",
    company: "Nunes Logística",
    tags: ["prioridade"],
    origin: "SITE",
    title: "Implantação completa",
    value: 15000,
    stage: "negotiation",
    owner: "seller",
    createdDaysAgo: 12,
    lastActivityDaysAgo: 5,
    openTask: {
      type: "MEETING",
      title: "Reunião com o sócio na loja",
      due: [0, 17, 30],
    },
  },
  {
    n: 9,
    contact: "Beatriz Farias",
    phone: "(81) 99109-0009",
    origin: "STORE",
    title: "Renovação anual",
    value: 5100,
    stage: "contacted",
    owner: "admin",
    createdDaysAgo: 5,
    lastActivityDaysAgo: 4,
    openTask: {
      type: "WHATSAPP",
      title: "Enviar casos de sucesso",
      due: [3, 9, 0],
    },
  },
  {
    n: 10,
    contact: "Otávio Ramos",
    phone: "(85) 99110-0010",
    email: "otavio.ramos@otcrm.com.br",
    company: "OT CRM",
    origin: "INSTAGRAM",
    title: "Projeto de CRM interno",
    value: 9200,
    stage: "new",
    owner: "seller",
    createdDaysAgo: 1,
    lastActivityDaysAgo: 1,
    openTask: { type: "WHATSAPP", title: "Primeiro contato", due: [0, 9, 30] },
  },
  {
    n: 11,
    contact: "Renata Soares",
    phone: "(11) 99111-0011",
    email: "renata@soaresdesign.com.br",
    company: "Soares Design",
    origin: "REFERRAL",
    title: "Site institucional",
    value: 7700,
    stage: "proposal",
    owner: "seller",
    createdDaysAgo: 14,
    lastActivityDaysAgo: 2,
    completedTask: {
      type: "CALL",
      title: "Apresentar proposta final",
      completed: [-3, 10, 0],
      result: "WON",
      note: "Fechou! Entrada de 50% paga no PIX.",
    },
    status: "WON",
    closedDaysAgo: 2,
  },
  {
    n: 12,
    contact: "Henrique Barros",
    phone: "(11) 99112-0012",
    company: "HB Integrações",
    origin: "OTHER",
    title: "Integração de sistemas",
    value: 3000,
    stage: "contacted",
    owner: "admin",
    createdDaysAgo: 11,
    lastActivityDaysAgo: 5,
    completedTask: {
      type: "CALL",
      title: "Ligar com a proposta",
      completed: [-5, 11, 0],
      result: "LOST",
      note: "Achou caro; foi para o concorrente.",
    },
    status: "LOST",
    lostReason: "Preço",
    lostNote: "Achou o investimento alto demais.",
    closedDaysAgo: 5,
  },
];

// ---------------------------------------------------------------- seed

async function main() {
  // Conta e usuários -----------------------------------------------------
  await prisma.account.upsert({
    where: { id: ACCOUNT_ID },
    create: { id: ACCOUNT_ID, name: "Empresa Demo", plan: "trial" },
    update: {},
  });

  await prisma.user.upsert({
    where: { id: USERS.admin },
    create: {
      id: USERS.admin,
      accountId: ACCOUNT_ID,
      name: "Ana Souza",
      email: "ana@demo.tervian.dev",
      emailVerified: true,
      role: "ADMIN",
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { id: USERS.seller },
    create: {
      id: USERS.seller,
      accountId: ACCOUNT_ID,
      name: "Bruno Lima",
      email: "bruno@demo.tervian.dev",
      emailVerified: true,
      role: "SELLER",
    },
    update: {},
  });

  // Credenciais de login da demo (Better Auth): providerId "credential" + hash
  // scrypt. Senha dos dois logins abaixo: demo1234 — apenas demonstração local
  // (documentada no README). Fora da demo, o caminho é cadastro/convite.
  const DEMO_PASSWORD = "demo1234";
  await prisma.authAccount.upsert({
    where: { id: "demo-auth-admin" },
    create: {
      id: "demo-auth-admin",
      providerId: "credential",
      accountId: USERS.admin,
      userId: USERS.admin,
      password: await hashPassword(DEMO_PASSWORD),
    },
    update: {},
  });
  await prisma.authAccount.upsert({
    where: { id: "demo-auth-seller" },
    create: {
      id: "demo-auth-seller",
      providerId: "credential",
      accountId: USERS.seller,
      userId: USERS.seller,
      password: await hashPassword(DEMO_PASSWORD),
    },
    update: {},
  });

  // Funil ----------------------------------------------------------------
  await prisma.pipeline.upsert({
    where: { id: "demo-pipeline" },
    create: { id: "demo-pipeline", accountId: ACCOUNT_ID, name: "Comercial" },
    update: {},
  });

  const stagesData = [
    { id: STAGES.new, name: STAGE_NAMES.new, position: 1, probability: 10, cadenceDays: null },
    {
      id: STAGES.contacted,
      name: STAGE_NAMES.contacted,
      position: 2,
      probability: 25,
      cadenceDays: 3,
    },
    {
      id: STAGES.proposal,
      name: STAGE_NAMES.proposal,
      position: 3,
      probability: 50,
      cadenceDays: 2,
    },
    {
      id: STAGES.negotiation,
      name: STAGE_NAMES.negotiation,
      position: 4,
      probability: 75,
      cadenceDays: 2,
    },
  ];
  for (const s of stagesData) {
    await prisma.stage.upsert({
      where: { id: s.id },
      create: { ...s, accountId: ACCOUNT_ID, pipelineId: "demo-pipeline" },
      update: {},
    });
  }

  // Motivos de perda -----------------------------------------------------
  for (const [name, id] of Object.entries(LOST_REASONS)) {
    await prisma.lostReason.upsert({
      where: { id },
      create: { id, accountId: ACCOUNT_ID, name },
      update: {},
    });
  }

  // Modelos de mensagem (P1 — já deixamos prontos para demonstração) -----
  await prisma.messageTemplate.upsert({
    where: { id: "demo-template-first-contact" },
    create: {
      id: "demo-template-first-contact",
      accountId: ACCOUNT_ID,
      name: "Primeiro contato",
      body: "Oi {nome}, tudo bem? Vi que você se interessou pela nossa solução. Podemos conversar 10 minutinhos hoje?",
      suggestedStageId: STAGES.contacted,
    },
    update: {},
  });
  await prisma.messageTemplate.upsert({
    where: { id: "demo-template-proposal-followup" },
    create: {
      id: "demo-template-proposal-followup",
      accountId: ACCOUNT_ID,
      name: "Follow-up da proposta",
      body: "Oi {nome}, passando para saber se você conseguiu olhar a proposta que enviei. Fico à disposição para ajustar o que precisar!",
      suggestedStageId: STAGES.proposal,
    },
    update: {},
  });

  // Contatos, negócios, tarefas e linha do tempo -------------------------
  for (const d of DEALS) {
    const nn = String(d.n).padStart(2, "0");
    const contactId = `demo-contact-${nn}`;
    const dealId = `demo-deal-${nn}`;
    const ownerId = USERS[d.owner];
    const stageId = STAGES[d.stage];
    const nextActionAt = d.openTask ? at(...d.openTask.due) : null;
    const closedAt = d.closedDaysAgo != null ? at(-d.closedDaysAgo, 12, 0) : null;

    await prisma.contact.upsert({
      where: { id: contactId },
      create: {
        id: contactId,
        accountId: ACCOUNT_ID,
        name: d.contact,
        phone: requirePhone(d.phone),
        email: d.email,
        companyText: d.company,
        origin: d.origin,
        tags: d.tags ?? [],
        ownerId,
      },
      update: {},
    });

    await prisma.deal.upsert({
      where: { id: dealId },
      create: {
        id: dealId,
        accountId: ACCOUNT_ID,
        title: d.title,
        value: d.value,
        stageId,
        contactId,
        ownerId,
        expectedCloseAt: d.expectedCloseInDays != null ? at(d.expectedCloseInDays, 18, 0) : null,
        status: d.status ?? "OPEN",
        lostReasonId: d.lostReason ? LOST_REASONS[d.lostReason] : null,
        lostNote: d.lostNote ?? null,
        closedAt,
        lastActivityAt: at(-d.lastActivityDaysAgo, 12, 0),
        nextActionAt,
      },
      update: {},
    });

    await prisma.timelineEvent.upsert({
      where: { id: `demo-ev-d${nn}-created` },
      create: {
        id: `demo-ev-d${nn}-created`,
        accountId: ACCOUNT_ID,
        type: "deal.created",
        payload: { title: d.title, stage: STAGE_NAMES[d.stage] },
        dealId,
        contactId,
        actorId: ownerId,
        createdAt: at(-d.createdDaysAgo, 9, 0),
      },
      update: {},
    });

    if (d.openTask) {
      await prisma.task.upsert({
        where: { id: `demo-task-d${nn}` },
        create: {
          id: `demo-task-d${nn}`,
          accountId: ACCOUNT_ID,
          dealId,
          ownerId,
          type: d.openTask.type,
          title: d.openTask.title,
          dueAt: nextActionAt!,
        },
        update: {},
      });
    }

    if (d.completedTask) {
      const completedAt = at(...d.completedTask.completed);
      await prisma.task.upsert({
        where: { id: `demo-task-d${nn}-done` },
        create: {
          id: `demo-task-d${nn}-done`,
          accountId: ACCOUNT_ID,
          dealId,
          ownerId,
          type: d.completedTask.type,
          title: d.completedTask.title,
          dueAt: completedAt,
          completedAt,
          result: d.completedTask.result,
          resultNote: d.completedTask.note ?? null,
        },
        update: {},
      });
      await prisma.timelineEvent.upsert({
        where: { id: `demo-ev-d${nn}-task-done` },
        create: {
          id: `demo-ev-d${nn}-task-done`,
          accountId: ACCOUNT_ID,
          type: "task.completed",
          payload: { title: d.completedTask.title, result: d.completedTask.result },
          dealId,
          contactId,
          actorId: ownerId,
          createdAt: completedAt,
        },
        update: {},
      });
    }

    if (d.status && closedAt) {
      await prisma.timelineEvent.upsert({
        where: { id: `demo-ev-d${nn}-closed` },
        create: {
          id: `demo-ev-d${nn}-closed`,
          accountId: ACCOUNT_ID,
          type: "deal.closed",
          payload: { status: d.status, reason: d.lostReason ?? null },
          dealId,
          contactId,
          actorId: ownerId,
          createdAt: closedAt,
        },
        update: {},
      });
    }
  }

  // Notas ----------------------------------------------------------------
  const notes = [
    {
      id: "demo-note-01",
      dealId: "demo-deal-04",
      authorId: USERS.admin,
      text: "Cliente pediu 5% de desconto para fechar esta semana. Avaliar com a equipe.",
      daysAgo: 2,
    },
    {
      id: "demo-note-02",
      dealId: "demo-deal-02",
      authorId: USERS.seller,
      text: "Sem resposta no WhatsApp até agora; tentar ligação.",
      daysAgo: 1,
    },
  ];
  for (const n of notes) {
    await prisma.note.upsert({
      where: { id: n.id },
      create: {
        id: n.id,
        accountId: ACCOUNT_ID,
        dealId: n.dealId,
        authorId: n.authorId,
        text: n.text,
        createdAt: at(-n.daysAgo, 12, 0),
      },
      update: {},
    });
    await prisma.timelineEvent.upsert({
      where: { id: `${n.id}-ev` },
      create: {
        id: `${n.id}-ev`,
        accountId: ACCOUNT_ID,
        type: "note.added",
        payload: { text: n.text },
        dealId: n.dealId,
        actorId: n.authorId,
        createdAt: at(-n.daysAgo, 12, 0),
      },
      update: {},
    });
  }

  const [contacts, deals, tasks] = await Promise.all([
    prisma.contact.count({ where: { accountId: ACCOUNT_ID } }),
    prisma.deal.count({ where: { accountId: ACCOUNT_ID } }),
    prisma.task.count({ where: { accountId: ACCOUNT_ID } }),
  ]);
  console.log(
    `Seed concluído ✓ — conta demo com ${contacts} contatos, ${deals} negócios e ${tasks} tarefas.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
