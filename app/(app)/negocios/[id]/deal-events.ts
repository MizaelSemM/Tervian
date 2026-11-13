import { formatCurrencyBR } from "@/lib/utils";
import { TASK_RESULT_LABELS } from "@/lib/schemas/deal";

/**
 * Descrição curta de um evento da timeline (006).
 *
 * A 008 vai centralizar `logEvent()` e enriquecer a linha do tempo; aqui o
 * objetivo é o detalhe do negócio já nascer legível.
 */

function asRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function text(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}

const FIELD_LABELS: Record<string, string> = {
  title: "título",
  value: "valor",
  ownerId: "responsável",
  expectedCloseAt: "previsão de fechamento",
};

export function describeTimelineEvent(type: string, payload: unknown): string {
  const data = asRecord(payload);

  switch (type) {
    case "deal.created": {
      const stage = text(data, "stage");
      return stage ? `Negócio criado na etapa “${stage}”.` : "Negócio criado.";
    }
    case "deal.stage_changed": {
      const from = text(data, "from");
      const to = text(data, "to");
      return from && to ? `Etapa alterada de “${from}” para “${to}”.` : "Etapa alterada.";
    }
    case "deal.owner_changed": {
      const from = text(data, "fromName");
      const to = text(data, "toName");
      return from && to
        ? `Responsável alterado de “${from}” para “${to}”.`
        : "Responsável alterado.";
    }
    case "deal.updated": {
      const fields = Array.isArray(data.fields)
        ? data.fields
            .filter((item): item is string => typeof item === "string")
            .map((field) => FIELD_LABELS[field] ?? field)
        : [];
      return fields.length ? `Negócio atualizado (${fields.join(", ")}).` : "Negócio atualizado.";
    }
    case "deal.next_action_changed":
      return "Próxima ação remarcada.";
    case "deal.closed": {
      if (text(data, "status") === "WON") {
        const value = data.value;
        return typeof value === "number"
          ? `Marcado como ganho por ${formatCurrencyBR(value)}.`
          : "Marcado como ganho.";
      }
      const reason = text(data, "reason");
      return reason ? `Marcado como perdido: ${reason}.` : "Marcado como perdido.";
    }
    case "task.completed": {
      const title = text(data, "title");
      const result = text(data, "result");
      const resultLabel = result ? (TASK_RESULT_LABELS as Record<string, string>)[result] : null;
      if (!title) return "Tarefa concluída.";
      return resultLabel
        ? `Tarefa concluída: ${title} (${resultLabel}).`
        : `Tarefa concluída: ${title}.`;
    }
    case "task.reopened":
      return "Conclusão desfeita: tarefa reaberta.";
    case "note.added":
      return "Nota adicionada.";
    case "note.updated":
      return "Nota editada.";
    case "note.deleted":
      return "Nota removida.";
    case "deal.deleted":
      return "Negócio removido do funil.";
    case "lead.captured_form": {
      const source = text(data, "utmSource");
      if (data.duplicate === true) {
        return source
          ? `Novo contato pelo formulário (origem: ${source}).`
          : "Novo contato pelo formulário.";
      }
      return source
        ? `Lead capturado pelo formulário (origem: ${source}).`
        : "Lead capturado pelo formulário.";
    }
    case "contact.created":
      return "Contato criado.";
    case "contact.updated":
      return "Contato atualizado.";
    case "contact.deleted":
      return "Contato removido.";
    case "import.completed": {
      const imported = typeof data.imported === "number" ? data.imported : null;
      return imported !== null
        ? `Importação concluída: ${imported} contatos.`
        : "Importação de contatos concluída.";
    }
    default:
      return `Evento: ${type}.`;
  }
}

export const describeDealEvent = describeTimelineEvent;
