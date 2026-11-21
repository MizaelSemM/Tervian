"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MESSAGE_TEMPLATE_BODY_MAX,
  MESSAGE_TEMPLATE_NAME_MAX,
  type MessageTemplateListItem,
} from "@/lib/message-template";

import {
  createMessageTemplateAction,
  deleteMessageTemplateAction,
  updateMessageTemplateAction,
  type MessageTemplateFormState,
} from "./template-actions";

type StageOption = { id: string; name: string };

const fieldClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const textareaClass =
  "w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function TemplateFields({
  idPrefix,
  template,
  stages,
  pending,
}: {
  idPrefix: string;
  template?: MessageTemplateListItem;
  stages: StageOption[];
  pending: boolean;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-name`}>Nome do modelo</Label>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            defaultValue={template?.name ?? ""}
            placeholder="Ex.: Retorno após reunião"
            maxLength={MESSAGE_TEMPLATE_NAME_MAX}
            required
            disabled={pending}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-stage`}>Etapa sugerida (opcional)</Label>
          <select
            id={`${idPrefix}-stage`}
            name="suggestedStageId"
            defaultValue={template?.suggestedStageId ?? ""}
            className={fieldClass}
            disabled={pending}
          >
            <option value="">Sem sugestão</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-body`}>Mensagem</Label>
        <textarea
          id={`${idPrefix}-body`}
          name="body"
          defaultValue={template?.body ?? ""}
          placeholder="Oi, {nome}! Passando para saber se você conseguiu ver a proposta..."
          rows={4}
          maxLength={MESSAGE_TEMPLATE_BODY_MAX}
          className={textareaClass}
          required
          disabled={pending}
        />
        <p className="text-[11px] text-muted-foreground">
          Variáveis: <code>{"{nome}"}</code>, <code>{"{empresa}"}</code> e{" "}
          <code>{"{vendedor}"}</code>. Elas são trocadas pelos dados do contato e de quem envia.
        </p>
      </div>
    </>
  );
}

function TemplateRow({
  template,
  stages,
}: {
  template: MessageTemplateListItem;
  stages: StageOption[];
}) {
  const [editing, setEditing] = useState(false);

  const [updateState, updateAction, updatePending] = useActionState<
    MessageTemplateFormState,
    FormData
  >(async (previous, formData) => {
    const result = await updateMessageTemplateAction(previous, formData);
    if (result?.success) {
      setEditing(false);
      toast.success(result.success);
    }
    return result;
  }, null);

  const [, deleteAction, deletePending] = useActionState<MessageTemplateFormState, FormData>(
    async (previous, formData) => {
      const result = await deleteMessageTemplateAction(previous, formData);
      if (result?.success) toast.success(result.success);
      if (result?.error) toast.error(result.error);
      return result;
    },
    null,
  );

  return (
    <li className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{template.name}</p>
            {template.suggestedStageName && (
              <Badge variant="outline">Sugerido em {template.suggestedStageName}</Badge>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm whitespace-pre-wrap text-muted-foreground">
            {template.body}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing((current) => !current)}
            disabled={deletePending}
          >
            <PencilIcon />
            {editing ? "Fechar" : "Editar"}
          </Button>
          <form
            action={deleteAction}
            onSubmit={(event) => {
              if (!window.confirm(`Excluir o modelo “${template.name}”?`)) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={template.id} />
            <Button type="submit" variant="destructive" size="sm" disabled={deletePending}>
              <Trash2Icon />
              {deletePending ? "Excluindo…" : "Excluir"}
            </Button>
          </form>
        </div>
      </div>

      {editing && (
        <form
          action={updateAction}
          className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3"
        >
          <input type="hidden" name="id" value={template.id} />
          <TemplateFields
            idPrefix={`template-${template.id}`}
            template={template}
            stages={stages}
            pending={updatePending}
          />

          {updateState?.error && (
            <p role="alert" className="text-sm text-destructive">
              {updateState.error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={updatePending}>
              {updatePending ? "Salvando…" : "Salvar modelo"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={updatePending}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

/**
 * Configuração dos modelos de mensagem (RF-36). Só ADMIN chega aqui (a página
 * usa `withAdmin`); o servidor revalida tudo nas actions.
 */
export function MessageTemplatesSettings({
  templates,
  stages,
}: {
  templates: MessageTemplateListItem[];
  stages: StageOption[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<MessageTemplateFormState, FormData>(
    async (previous, formData) => {
      const result = await createMessageTemplateAction(previous, formData);
      if (result?.success) formRef.current?.reset();
      return result;
    },
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modelos de mensagem</CardTitle>
        <CardDescription>
          Mensagens prontas para o WhatsApp, com variáveis preenchidas automaticamente. Os
          vendedores escolhem o modelo na tela “Hoje” e nos detalhes de contato/negócio.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form
          ref={formRef}
          action={formAction}
          className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3"
        >
          <p className="flex items-center gap-2 text-sm font-medium">
            <PlusIcon className="size-4" />
            Novo modelo
          </p>

          <TemplateFields idPrefix="new-template" stages={stages} pending={pending} />

          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state?.success && (
            <p role="status" className="text-sm text-success">
              {state.success}
            </p>
          )}

          <Button type="submit" size="sm" className="self-start" disabled={pending}>
            {pending ? "Criando…" : "Criar modelo"}
          </Button>
        </form>

        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum modelo cadastrado ainda. Crie o primeiro acima.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {templates.map((template) => (
              <TemplateRow key={template.id} template={template} stages={stages} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
