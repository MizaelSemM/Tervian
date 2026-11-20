// Suíte da edição das etapas do funil (RF-24) — roda contra o banco real.
//
// Cobre nome/probabilidade/ordem, a primeira etapa como entrada de novos leads,
// validação de formulário velho/etapa de outra conta e isolamento entre contas.
// Requer DATABASE_URL.
import { afterAll, describe, expect, it } from "vitest";

import type { PipelineStageUpdate } from "@/lib/pipeline";
import { prismaBase } from "@/lib/prisma";
import { runWithTenant } from "@/lib/tenant-context";
import { createLead } from "@/server/services/leads";
import { listDealBoard, getDeal } from "@/server/services/deals";
import {
  ensureDefaultPipeline,
  getPipelineStages,
  updatePipelineStages,
  type StageRef,
} from "@/server/services/pipeline";

const run = Math.random().toString(36).slice(2, 8);
const accountIds: string[] = [];
let phoneSeq = 0;

type Seeded = {
  accountId: string;
  admin: { id: string; name: string };
};

function nextPhone(): string {
  phoneSeq += 1;
  return `+55119666${String(phoneSeq).padStart(4, "0")}`;
}

async function makeAccount(tag: string): Promise<Seeded> {
  const account = await prismaBase.account.create({
    data: { name: `[teste 020 etapas] ${tag} ${run}` },
  });
  accountIds.push(account.id);

  const admin = await prismaBase.user.create({
    data: {
      accountId: account.id,
      name: `Admin ${tag}`,
      email: `pipeline-admin-${tag}-${run}@teste.tervian.dev`,
      role: "ADMIN",
    },
    select: { id: true, name: true },
  });

  return { accountId: account.id, admin };
}

function asUser<T>(seeded: Seeded, fn: () => Promise<T>): Promise<T> {
  return runWithTenant({ accountId: seeded.accountId, userId: seeded.admin.id }, fn);
}

function acting(seeded: Seeded) {
  return { id: seeded.admin.id, role: "ADMIN" as const };
}

function updatesFrom(stages: StageRef[]): PipelineStageUpdate[] {
  return stages.map(({ id, name, probability }) => ({ id, name, probability }));
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

describe("edição das etapas do funil (integração)", () => {
  it("salva nome, probabilidade e ordem, e novos leads entram na primeira etapa", async () => {
    const seeded = await makeAccount("ordem");
    const original = await asUser(seeded, () => getPipelineStages());
    const [novo, contatado, proposta, negociacao] = original;
    if (!novo || !contatado || !proposta || !negociacao) {
      throw new Error("O funil padrão deveria ter quatro etapas.");
    }

    const updated = await asUser(seeded, () =>
      updatePipelineStages([
        { id: contatado.id, name: contatado.name, probability: 30 },
        { id: novo.id, name: "Entrada renomeada", probability: 15 },
        { id: proposta.id, name: proposta.name, probability: 55 },
        { id: negociacao.id, name: negociacao.name, probability: 80 },
      ]),
    );

    expect(updated.map((stage) => stage.id)).toEqual([
      contatado.id,
      novo.id,
      proposta.id,
      negociacao.id,
    ]);
    expect(updated.map((stage) => stage.position)).toEqual([1, 2, 3, 4]);
    expect(updated.map((stage) => stage.probability)).toEqual([30, 15, 55, 80]);

    const fresh = await asUser(seeded, () => getPipelineStages());
    expect(fresh).toEqual(updated);

    const pipeline = await asUser(seeded, () => ensureDefaultPipeline());
    expect(pipeline.newStage).toMatchObject({ id: contatado.id, position: 1 });

    const lead = await asUser(seeded, () =>
      createLead({
        actingUser: acting(seeded),
        name: "Lead com funil editado",
        phone: nextPhone(),
      }),
    );
    expect(lead.status).toBe("created");
    if (lead.status !== "created") return;

    const deal = await asUser(seeded, () =>
      getDeal({ id: lead.dealId, actingUser: acting(seeded) }),
    );
    expect(deal?.stageName).toBe(contatado.name);

    const board = await asUser(seeded, () => listDealBoard({ actingUser: acting(seeded) }));
    expect(board.stages.map((stage) => stage.id)).toEqual([
      contatado.id,
      novo.id,
      proposta.id,
      negociacao.id,
    ]);
    expect(board.stages[0]?.deals.some((item) => item.id === lead.dealId)).toBe(true);

    const stored = await prismaBase.stage.findMany({
      where: { accountId: seeded.accountId },
      orderBy: { position: "asc" },
      select: { probability: true },
    });
    expect(stored.map((stage) => stage.probability)).toEqual([30, 15, 55, 80]);
  });

  it("recusa formulário velho, etapa de outra conta, nomes repetidos e valores inválidos", async () => {
    const seeded = await makeAccount("validacao");
    const other = await makeAccount("validacao-outra");
    const before = await asUser(seeded, () => getPipelineStages());
    const otherStages = await asUser(other, () => getPipelineStages());
    const full = updatesFrom(before);
    const foreign = otherStages[0];
    if (!foreign) throw new Error("A outra conta deveria ter etapas.");

    await expect(
      asUser(seeded, () => updatePipelineStages(full.slice(0, -1))),
    ).rejects.toMatchObject({ code: "PIPELINE_STAGES_CHANGED" });

    await expect(
      asUser(seeded, () =>
        updatePipelineStages(
          full.map((stage, index) =>
            index === full.length - 1 ? { ...stage, id: foreign.id } : stage,
          ),
        ),
      ),
    ).rejects.toMatchObject({ code: "PIPELINE_STAGES_CHANGED" });

    await expect(
      asUser(seeded, () =>
        updatePipelineStages(
          full.map((stage, index) =>
            index === 1 ? { ...stage, name: full[0]?.name.toUpperCase() ?? "" } : stage,
          ),
        ),
      ),
    ).rejects.toMatchObject({ code: "PIPELINE_STAGE_NAME_TAKEN" });

    await expect(
      asUser(seeded, () =>
        updatePipelineStages(
          full.map((stage, index) => (index === 0 ? { ...stage, probability: 101 } : stage)),
        ),
      ),
    ).rejects.toMatchObject({ code: "PIPELINE_STAGE_INVALID" });

    await expect(
      asUser(seeded, () =>
        updatePipelineStages(
          full.map((stage, index) => (index === 0 ? { ...stage, name: "A" } : stage)),
        ),
      ),
    ).rejects.toMatchObject({ code: "PIPELINE_STAGE_INVALID" });

    const after = await asUser(seeded, () => getPipelineStages());
    expect(after).toEqual(before);

    const otherAfter = await asUser(other, () => getPipelineStages());
    expect(otherAfter).toEqual(otherStages);
  });
});
