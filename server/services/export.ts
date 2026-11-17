import { toCsv } from "@/lib/csv";
import { CONTACT_ORIGIN_LABELS } from "@/lib/schemas/contact";
import { DEAL_STATUS_LABELS } from "@/lib/schemas/deal";
import { tenantDb } from "@/lib/tenant-prisma";

/**
 * Exportação CSV da conta (RF-54).
 *
 * O JSON da LGPD (013) atende o titular e preserva tudo o que o banco guarda.
 * Esta exportação é a visão de negócio: linhas legíveis, prontas para abrir no
 * Excel/Sheets ou levar para outra ferramenta.
 *
 * Inclui registros com exclusão lógica e marca a data em `Excluído em` — a
 * empresa é dona dos dados e decide o que fazer com o histórico.
 */

function iso(value: Date | null): string {
  return value ? value.toISOString() : "";
}

function money(value: { toString(): string } | null): string {
  return value === null ? "" : Number(value).toFixed(2).replace(".", ",");
}

const CONTACT_HEADERS = [
  "ID",
  "Nome",
  "Telefone",
  "E-mail",
  "Empresa",
  "Origem",
  "Tags",
  "Responsável",
  "Criado em",
  "Excluído em",
];

export async function exportContactsCsv(): Promise<string> {
  const contacts = await tenantDb().contact.findMany({
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      companyText: true,
      origin: true,
      tags: true,
      createdAt: true,
      deletedAt: true,
      owner: { select: { name: true } },
    },
  });

  const rows = contacts.map((contact) => [
    contact.id,
    contact.name,
    contact.phone,
    contact.email,
    contact.companyText,
    contact.origin ? CONTACT_ORIGIN_LABELS[contact.origin] : "",
    contact.tags.join(", "),
    contact.owner?.name ?? "",
    iso(contact.createdAt),
    iso(contact.deletedAt),
  ]);

  return toCsv([CONTACT_HEADERS, ...rows]);
}

const DEAL_HEADERS = [
  "ID",
  "Título",
  "Contato",
  "Telefone",
  "Etapa",
  "Responsável",
  "Valor (R$)",
  "Status",
  "Previsão de fechamento",
  "Próxima ação",
  "Última atividade",
  "Fechado em",
  "Motivo da perda",
  "Observação da perda",
  "Criado em",
  "Excluído em",
];

export async function exportDealsCsv(): Promise<string> {
  const deals = await tenantDb().deal.findMany({
    orderBy: [{ createdAt: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      value: true,
      status: true,
      expectedCloseAt: true,
      nextActionAt: true,
      lastActivityAt: true,
      closedAt: true,
      lostNote: true,
      createdAt: true,
      deletedAt: true,
      contact: { select: { name: true, phone: true } },
      stage: { select: { name: true } },
      owner: { select: { name: true } },
      lostReason: { select: { name: true } },
    },
  });

  const rows = deals.map((deal) => [
    deal.id,
    deal.title,
    deal.contact.name,
    deal.contact.phone,
    deal.stage.name,
    deal.owner.name,
    money(deal.value),
    DEAL_STATUS_LABELS[deal.status],
    iso(deal.expectedCloseAt),
    iso(deal.nextActionAt),
    iso(deal.lastActivityAt),
    iso(deal.closedAt),
    deal.lostReason?.name ?? "",
    deal.lostNote ?? "",
    iso(deal.createdAt),
    iso(deal.deletedAt),
  ]);

  return toCsv([DEAL_HEADERS, ...rows]);
}
