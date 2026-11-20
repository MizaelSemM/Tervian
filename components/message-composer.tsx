"use client";

import { CopyIcon, MessageSquareTextIcon, SendIcon, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  MESSAGE_TEMPLATE_BODY_MAX,
  MESSAGE_TEMPLATE_VARIABLES,
  firstName,
  renderMessageTemplate,
  type MessageTemplateRecord,
} from "@/lib/message-template";
import { whatsappLinkBR } from "@/lib/phone";
import { cn } from "@/lib/utils";

type ButtonProps = ComponentProps<typeof Button>;

/**
 * Composer de mensagem pronta (RF-36).
 *
 * O botão abre um diálogo nativo (foco preso + Esc de graça) com os modelos da
 * conta. A mensagem é renderizada no client, pode ser editada, copiada ou
 * enviada direto ao WhatsApp via `wa.me?text=`.
 */
export function MessageComposer({
  templates,
  contactName,
  companyName,
  sellerName,
  phone,
  stageId = null,
  triggerLabel = "Mensagem",
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerClassName,
}: {
  templates: MessageTemplateRecord[];
  contactName: string;
  companyName?: string | null;
  sellerName: string;
  phone: string;
  stageId?: string | null;
  triggerLabel?: string;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  triggerClassName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const rawId = useId();
  const titleId = `mensagem-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [open, setOpen] = useState(false);

  // Sugestão da etapa primeiro; o resto mantém a ordem alfabética do serviço.
  const orderedTemplates = stageId
    ? [...templates].sort(
        (a, b) => Number(b.suggestedStageId === stageId) - Number(a.suggestedStageId === stageId),
      )
    : templates;

  const [selectedId, setSelectedId] = useState(orderedTemplates[0]?.id ?? "");
  const selected =
    orderedTemplates.find((template) => template.id === selectedId) ?? orderedTemplates[0] ?? null;

  const vars = { contactName, companyName, sellerName };
  const [text, setText] = useState(() =>
    selected ? renderMessageTemplate(selected.body, vars) : "",
  );

  const whatsappHref = whatsappLinkBR(phone, text.trim() || undefined);
  const contactFirstName = firstName(contactName);

  // O diálogo só entra no DOM quando aberto (a fila do dia pode ter 200 cards).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || dialog.open) return;
    dialog.showModal();
  }, [open]);

  function openDialog() {
    if (selected) setText(renderMessageTemplate(selected.body, vars));
    setOpen(true);
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function selectTemplate(template: MessageTemplateRecord) {
    setSelectedId(template.id);
    setText(renderMessageTemplate(template.body, vars));
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Mensagem copiada.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openDialog}
      >
        <MessageSquareTextIcon />
        {triggerLabel}
      </Button>

      {open && (
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          onClose={() => setOpen(false)}
          onClick={(event) => {
            if (event.target === dialogRef.current) closeDialog();
          }}
          className="m-auto w-[calc(100vw_-_2rem)] max-w-lg rounded-xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/50"
        >
          <div className="flex max-h-[85dvh] flex-col">
            <header className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 id={titleId} className="text-base font-semibold">
                  {contactFirstName ? `Mensagem para ${contactFirstName}` : "Mensagem pronta"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Escolha o modelo, revise e envie pelo WhatsApp.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={closeDialog}
                aria-label="Fechar"
              >
                <XIcon />
              </Button>
            </header>

            <div className="flex flex-col gap-4 overflow-y-auto p-4">
              {templates.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  Nenhum modelo cadastrado. Peça a um administrador para criar modelos em
                  Configurações — ou abra o WhatsApp sem mensagem pronta.
                </p>
              ) : (
                <>
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-xs font-medium text-muted-foreground">
                      Modelo
                    </legend>
                    <div className="flex max-h-44 flex-col gap-2 overflow-y-auto pr-1">
                      {orderedTemplates.map((template) => {
                        const isSelected = selected?.id === template.id;
                        const isSuggested = Boolean(
                          stageId && template.suggestedStageId === stageId,
                        );

                        return (
                          <button
                            key={template.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => selectTemplate(template)}
                            className={cn(
                              "flex flex-col gap-1 rounded-lg border p-2 text-left text-sm transition-colors",
                              isSelected
                                ? "border-primary bg-muted"
                                : "border-border hover:bg-muted/60",
                            )}
                          >
                            <span className="flex flex-wrap items-center gap-2 font-medium">
                              {template.name}
                              {isSuggested && <Badge variant="secondary">Sugerido</Badge>}
                            </span>
                            <span className="line-clamp-1 text-xs text-muted-foreground">
                              {template.body}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`${titleId}-texto`} className="text-xs font-medium">
                      Mensagem
                    </label>
                    <textarea
                      id={`${titleId}-texto`}
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      rows={6}
                      maxLength={MESSAGE_TEMPLATE_BODY_MAX * 2}
                      className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Variáveis:{" "}
                      {MESSAGE_TEMPLATE_VARIABLES.map((variable) => `{${variable}}`).join(", ")}.
                      Você pode editar antes de enviar.
                    </p>
                  </div>
                </>
              )}
            </div>

            <footer className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:flex-1"
                onClick={copyMessage}
                disabled={!text.trim()}
              >
                <CopyIcon />
                Copiar
              </Button>
              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ className: "h-11 sm:flex-1" })}
                >
                  <SendIcon />
                  Abrir no WhatsApp
                </a>
              ) : (
                <Button type="button" className="h-11 sm:flex-1" disabled>
                  <SendIcon />
                  Sem número
                </Button>
              )}
            </footer>
          </div>
        </dialog>
      )}
    </>
  );
}
