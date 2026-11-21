"use client";

import {
  CalendarClockIcon,
  CheckIcon,
  CircleCheckIcon,
  MessageCircleIcon,
  PhoneIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageComposer } from "@/components/message-composer";
import type { TodayData, TodayTask } from "@/lib/followup-types";
import type { MessageTemplateRecord } from "@/lib/message-template";
import { formatPhoneBR, whatsappLinkBR } from "@/lib/phone";
import { TASK_RESULT_LABELS } from "@/lib/schemas/deal";
import { TASK_RESULT_VALUES, type TaskResultValue } from "@/lib/schemas/followup";
import { addDaysToDateKey } from "@/lib/timezone";
import { cn, formatCurrencyBR } from "@/lib/utils";

import { completeTaskAction, undoCompleteTaskAction } from "./actions";

type Tone = "overdue" | "today";

type CompleteInput = {
  result: TaskResultValue;
  resultNote?: string;
  nextActionDate?: string;
  wonValue?: string | number;
  lostReasonId?: string;
  lostNote?: string;
};

const selectClassName =
  "h-11 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * Tela "Hoje" (007): lista curta, botões grandes e conclusão em dois toques.
 *
 * A remoção da linha é otimista (`useOptimistic`); se o server action falhar, o
 * React restaura a lista original no fim da transição e mostramos o erro.
 */
export function TodayView({
  data,
  firstName,
  sellerName,
  isAdmin,
  messageTemplates,
}: {
  data: TodayData;
  firstName: string;
  sellerName: string;
  isAdmin: boolean;
  messageTemplates: MessageTemplateRecord[];
}) {
  const [state, applyComplete] = useOptimistic(data, (current, taskId: string) => {
    const wasOverdue = current.overdue.some((task) => task.id === taskId);
    const wasToday = current.today.some((task) => task.id === taskId);
    if (!wasOverdue && !wasToday) return current;

    return {
      ...current,
      overdue: current.overdue.filter((task) => task.id !== taskId),
      today: current.today.filter((task) => task.id !== taskId),
      counts: {
        overdue: current.counts.overdue - (wasOverdue ? 1 : 0),
        today: current.counts.today - (wasToday ? 1 : 0),
        completedToday: current.counts.completedToday + 1,
      },
    };
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleUndo(taskId: string) {
    startTransition(async () => {
      const response = await undoCompleteTaskAction(taskId);
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      toast.success("Tarefa reaberta.");
      router.refresh();
    });
  }

  function handleComplete(task: TodayTask, input: CompleteInput) {
    if (pendingTaskId) return;
    setPendingTaskId(task.id);

    startTransition(async () => {
      applyComplete(task.id);
      try {
        const response = await completeTaskAction({
          taskId: task.id,
          ...input,
          resultNote: input.resultNote?.trim() || undefined,
          lostNote: input.lostNote?.trim() || undefined,
        });

        if (!response.ok) {
          toast.error(response.error);
          return;
        }

        setExpandedId(null);
        const undo = response.canUndo
          ? { label: "Desfazer", onClick: () => handleUndo(task.id) }
          : undefined;

        if (input.result === "WON") {
          toast.success("Negócio ganho! Próxima ação encerrada.", { action: undo });
        } else if (input.result === "LOST") {
          toast.success("Negócio perdido. O motivo ficou registrado.", { action: undo });
        } else {
          toast.success("Tarefa concluída. Próxima ação agendada.", { action: undo });
        }
      } catch {
        toast.error("Não foi possível concluir a tarefa. Tente novamente.");
      } finally {
        setPendingTaskId(null);
      }
    });
  }

  const empty = state.counts.overdue === 0 && state.counts.today === 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 pb-4">
      <header className="flex flex-col gap-6">
        <div>
          <p className="text-[13px] font-medium text-muted-foreground">{state.todayLabel}</p>
          <h1 className="text-page-title mt-1">Olá, {firstName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estas são as conversas que pedem ação hoje.
          </p>
        </div>

        <Summary counts={state.counts} />

        {isAdmin && <SellerFilter data={data} />}
      </header>

      {state.counts.overdue === 0 && !empty && (
        <p className="flex items-center gap-2 rounded-lg border border-success/20 bg-success-soft px-3 py-2 text-sm text-success">
          <CircleCheckIcon className="size-4 shrink-0" aria-hidden />
          Nada atrasado. O dia começa limpo.
        </p>
      )}

      {empty ? (
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <CalendarClockIcon className="size-6 text-primary" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold tracking-[-0.01em]">Nada na pauta de hoje.</h2>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
            {state.counts.completedToday > 0
              ? `Você concluiu ${state.counts.completedToday} ${
                  state.counts.completedToday === 1 ? "tarefa" : "tarefas"
                } hoje. As próximas ações aparecem aqui na data marcada.`
              : "Nenhuma tarefa vencida ou marcada para hoje. As próximas ações aparecem aqui na data marcada."}
          </p>
          <Link
            href="/negocios"
            className={buttonVariants({ variant: "outline", className: "mt-4 h-11" })}
          >
            Ver negócios
          </Link>
        </div>
      ) : (
        <>
          {state.overdue.length > 0 && (
            <TaskSection
              title="Atrasadas"
              description="Resolva primeiro o que já passou da data."
              tasks={state.overdue}
              tone="overdue"
              isAdmin={isAdmin}
              expandedId={expandedId}
              pendingTaskId={pendingTaskId}
              lostReasons={state.lostReasons}
              todayKey={state.todayKey}
              sellerName={sellerName}
              messageTemplates={messageTemplates}
              onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
              onComplete={handleComplete}
            />
          )}

          {state.today.length > 0 ? (
            <TaskSection
              title="Hoje"
              description="Toque em concluir, escolha o resultado e a próxima data."
              tasks={state.today}
              tone="today"
              isAdmin={isAdmin}
              expandedId={expandedId}
              pendingTaskId={pendingTaskId}
              lostReasons={state.lostReasons}
              todayKey={state.todayKey}
              sellerName={sellerName}
              messageTemplates={messageTemplates}
              onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
              onComplete={handleComplete}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Sem tarefas para hoje. As atrasadas continuam na lista acima.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Summary({ counts }: { counts: TodayData["counts"] }) {
  const items = [
    { label: "Atrasadas", value: counts.overdue, tone: "overdue" },
    { label: "Hoje", value: counts.today, tone: "today" },
    { label: "Concluídas hoje", value: counts.completedToday, tone: "done" },
  ] as const;

  return (
    <dl className="grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-card">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn("px-3 py-3 sm:px-4", index > 0 && "border-l border-border")}
        >
          <dt className="text-[11px] leading-tight font-medium text-muted-foreground">
            {item.label}
          </dt>
          <dd
            className={cn(
              "mt-1 text-[26px] leading-none font-semibold tracking-[-0.03em] tabular-nums",
              item.tone === "overdue" && item.value > 0 && "text-destructive",
              item.tone === "today" && item.value > 0 && "text-primary",
              item.tone === "done" && item.value > 0 && "text-success",
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SellerFilter({ data }: { data: TodayData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor="vendedor" className="shrink-0 text-xs font-medium text-muted-foreground">
        Ver tarefas de
      </Label>
      <select
        id="vendedor"
        className="h-9 w-auto min-w-44 max-w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        value={data.ownerFilter ?? ""}
        disabled={isPending}
        onChange={(event) => {
          const ownerId = event.target.value;
          startTransition(() => {
            router.push(ownerId ? `/hoje?vendedor=${encodeURIComponent(ownerId)}` : "/hoje");
          });
        }}
      >
        <option value="">Todos os vendedores</option>
        {data.sellers.map((seller) => (
          <option key={seller.id} value={seller.id}>
            {seller.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function TaskSection({
  title,
  description,
  tasks,
  tone,
  isAdmin,
  expandedId,
  pendingTaskId,
  lostReasons,
  todayKey,
  sellerName,
  messageTemplates,
  onToggle,
  onComplete,
}: {
  title: string;
  description: string;
  tasks: TodayTask[];
  tone: Tone;
  isAdmin: boolean;
  expandedId: string | null;
  pendingTaskId: string | null;
  lostReasons: Array<{ id: string; name: string }>;
  todayKey: string;
  sellerName: string;
  messageTemplates: MessageTemplateRecord[];
  onToggle: (id: string) => void;
  onComplete: (task: TodayTask, input: CompleteInput) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
        </div>
        <span
          className={cn(
            "inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-semibold tabular-nums",
            tone === "overdue"
              ? "bg-destructive/10 text-destructive"
              : "bg-accent text-accent-foreground",
          )}
        >
          {tasks.length}
        </span>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            tone={tone}
            isAdmin={isAdmin}
            expanded={expandedId === task.id}
            pending={pendingTaskId === task.id}
            lostReasons={lostReasons}
            todayKey={todayKey}
            sellerName={sellerName}
            messageTemplates={messageTemplates}
            onToggle={() => onToggle(task.id)}
            onComplete={(input) => onComplete(task, input)}
          />
        ))}
      </div>
    </section>
  );
}

function TaskCard({
  task,
  tone,
  isAdmin,
  expanded,
  pending,
  lostReasons,
  todayKey,
  sellerName,
  messageTemplates,
  onToggle,
  onComplete,
}: {
  task: TodayTask;
  tone: Tone;
  isAdmin: boolean;
  expanded: boolean;
  pending: boolean;
  lostReasons: Array<{ id: string; name: string }>;
  todayKey: string;
  sellerName: string;
  messageTemplates: MessageTemplateRecord[];
  onToggle: () => void;
  onComplete: (input: CompleteInput) => void;
}) {
  const whatsapp = whatsappLinkBR(task.contactPhone);

  return (
    <article
      className={cn(
        "bg-card",
        tone === "overdue" ? "border-l-[3px] border-destructive" : "border-l-[3px] border-primary",
      )}
    >
      <div className="p-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
          <Link
            href={`/negocios/${task.dealId}`}
            className="truncate text-[16px] leading-snug font-semibold tracking-[-0.01em] hover:underline"
          >
            {task.contactName}
          </Link>
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
              tone === "overdue"
                ? "bg-destructive/10 text-destructive"
                : "bg-accent text-accent-foreground",
            )}
          >
            {tone === "overdue"
              ? `Atrasada há ${task.overdueDays} ${task.overdueDays === 1 ? "dia" : "dias"}`
              : `Hoje, ${task.dueTimeLabel}`}
          </span>
        </div>

        <p className="mt-1 truncate text-sm text-muted-foreground">{task.dealTitle}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <PhoneIcon className="size-3" aria-hidden />
            {formatPhoneBR(task.contactPhone)}
          </span>
          <span>{task.title}</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            {task.stageName}
          </span>
          {task.dealValue !== null && (
            <span className="font-semibold text-foreground tabular-nums">
              {formatCurrencyBR(task.dealValue)}
            </span>
          )}
          {isAdmin && (
            <span className="inline-flex items-center gap-1">
              <UserRoundIcon className="size-3" aria-hidden />
              {task.ownerName}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-border bg-muted/30 p-3 sm:flex sm:items-center">
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline", className: "h-11" })}
          >
            <MessageCircleIcon />
            WhatsApp
          </a>
        ) : (
          <Button variant="outline" className="h-11" disabled>
            <MessageCircleIcon />
            Sem número
          </Button>
        )}
        <a
          href={`tel:${task.contactPhone}`}
          className={buttonVariants({ variant: "outline", className: "h-11" })}
        >
          <PhoneIcon />
          Ligar
        </a>
        <div className="col-span-2 sm:col-span-1 sm:w-44">
          <MessageComposer
            templates={messageTemplates}
            contactName={task.contactName}
            companyName={task.contactCompany}
            sellerName={sellerName}
            phone={task.contactPhone}
            stageId={task.stageId}
            triggerLabel="Mensagem pronta"
            triggerClassName="h-11 w-full"
          />
        </div>
        <Button
          className="col-span-2 h-11 sm:ml-auto sm:w-32"
          variant={expanded ? "secondary" : "default"}
          onClick={onToggle}
          disabled={pending}
          aria-expanded={expanded}
        >
          <CheckIcon />
          {expanded ? "Fechar" : "Concluir"}
        </Button>
      </div>

      {expanded && (
        <CompletionPanel
          task={task}
          pending={pending}
          lostReasons={lostReasons}
          todayKey={todayKey}
          onComplete={onComplete}
        />
      )}
    </article>
  );
}

function CompletionPanel({
  task,
  pending,
  lostReasons,
  todayKey,
  onComplete,
}: {
  task: TodayTask;
  pending: boolean;
  lostReasons: Array<{ id: string; name: string }>;
  todayKey: string;
  onComplete: (input: CompleteInput) => void;
}) {
  const [result, setResult] = useState<TaskResultValue | null>(null);
  const [note, setNote] = useState("");
  const [wonValue, setWonValue] = useState(task.dealValue === null ? "" : String(task.dealValue));
  const [lostReasonId, setLostReasonId] = useState(lostReasons[0]?.id ?? "");
  const [lostNote, setLostNote] = useState("");
  const [manualDate, setManualDate] = useState("");

  const isClosed = result === "WON" || result === "LOST";
  const shortcuts = [
    { label: "Amanhã", dateKey: addDaysToDateKey(todayKey, 1) },
    { label: "Em 3 dias", dateKey: addDaysToDateKey(todayKey, 3) },
    { label: "Em 1 semana", dateKey: addDaysToDateKey(todayKey, 7) },
  ];

  function submitNextAction(dateKey: string) {
    if (!result || isClosed) return;
    onComplete({ result, resultNote: note, nextActionDate: dateKey });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-muted/40 p-4 sm:p-5">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">Resultado do contato</p>
        <div className="flex flex-wrap gap-2">
          {TASK_RESULT_VALUES.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={result === value ? "default" : "outline"}
              className="h-11"
              onClick={() => setResult(value)}
              disabled={pending}
            >
              {TASK_RESULT_LABELS[value]}
            </Button>
          ))}
        </div>
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Observação (opcional)"
          maxLength={500}
          className="h-11"
          disabled={pending}
        />
      </div>

      {result === "WON" && (
        <div className="flex flex-col gap-2 rounded-lg border border-success/25 bg-success-soft p-3">
          <p className="text-sm font-semibold text-success">Fechar como ganho</p>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`won-value-${task.id}`}>Valor final (R$)</Label>
            <Input
              id={`won-value-${task.id}`}
              inputMode="decimal"
              value={wonValue}
              onChange={(event) => setWonValue(event.target.value)}
              placeholder="0,00"
              className="h-11"
              disabled={pending}
            />
          </div>
          <Button
            type="button"
            className="h-11"
            onClick={() =>
              onComplete({
                result: "WON",
                resultNote: note,
                wonValue: wonValue.trim() || undefined,
              })
            }
            disabled={pending || (task.dealValue === null && !wonValue.trim())}
          >
            Confirmar ganho
          </Button>
        </div>
      )}

      {result === "LOST" && (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-medium">Fechar como perdido</p>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`lost-reason-${task.id}`}>Motivo</Label>
            <select
              id={`lost-reason-${task.id}`}
              className={selectClassName}
              value={lostReasonId}
              onChange={(event) => setLostReasonId(event.target.value)}
              disabled={pending}
            >
              {lostReasons.length === 0 && <option value="">Nenhum motivo cadastrado</option>}
              {lostReasons.map((reason) => (
                <option key={reason.id} value={reason.id}>
                  {reason.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            value={lostNote}
            onChange={(event) => setLostNote(event.target.value)}
            placeholder="O que aconteceu? (opcional)"
            maxLength={500}
            className="h-11"
            disabled={pending}
          />
          <Button
            type="button"
            variant="destructive"
            className="h-11"
            onClick={() =>
              onComplete({
                result: "LOST",
                resultNote: note,
                lostReasonId,
                lostNote,
              })
            }
            disabled={pending || !lostReasonId}
          >
            Confirmar perda
          </Button>
        </div>
      )}

      {result && !isClosed && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-semibold">Quando retomar?</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {shortcuts.map((shortcut) => (
              <Button
                key={shortcut.label}
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => submitNextAction(shortcut.dateKey)}
                disabled={pending}
              >
                <CalendarClockIcon />
                {shortcut.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              type="date"
              min={todayKey}
              value={manualDate}
              onChange={(event) => setManualDate(event.target.value)}
              className="h-11"
              disabled={pending}
              aria-label="Outra data para a próxima ação"
            />
            <Button
              type="button"
              className="h-11"
              onClick={() => manualDate && submitNextAction(manualDate)}
              disabled={pending || !manualDate}
            >
              Agendar
            </Button>
          </div>
        </div>
      )}

      {!result && (
        <p className="text-xs text-muted-foreground">
          Escolha o resultado e depois a data da próxima ação. Dois toques.
        </p>
      )}
    </div>
  );
}
