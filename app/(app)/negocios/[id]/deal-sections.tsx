import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPhoneBR, whatsappLinkBR } from "@/lib/phone";
import {
  DEAL_STATUS_LABELS,
  TASK_RESULT_LABELS,
  TASK_TYPE_LABELS,
  type DealStatusValue,
} from "@/lib/schemas/deal";
import { formatCurrencyBR, formatDateBR, formatDateTimeBR } from "@/lib/utils";
import type { DealNote, DealTask, DealTimelineEvent } from "@/server/services/deals";

import { describeDealEvent } from "./deal-events";

/** Blocos de leitura do detalhe: contato, tarefas, timeline e notas. */

export function DealContactCard({
  contact,
  email,
  company,
}: {
  contact: { id: string; name: string; phone: string };
  email: string | null;
  company: string | null;
}) {
  const whatsapp = whatsappLinkBR(contact.phone);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contato</CardTitle>
        <CardDescription>Quem está do outro lado da negociação.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div>
          <Link href={`/contatos/${contact.id}`} className="text-sm font-medium hover:underline">
            {contact.name}
          </Link>
          <p className="text-sm text-muted-foreground">{formatPhoneBR(contact.phone)}</p>
          {email && <p className="text-sm text-muted-foreground">{email}</p>}
          {company && <p className="text-sm text-muted-foreground">{company}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              WhatsApp
            </a>
          )}
          <a
            href={`tel:${contact.phone}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Ligar
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export function DealClosedSummary({
  status,
  value,
  closedAt,
  lostReasonName,
  lostNote,
}: {
  status: DealStatusValue;
  value: number | null;
  closedAt: Date | null;
  lostReasonName: string | null;
  lostNote: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Negócio fechado</CardTitle>
        <CardDescription>
          Este negócio não aparece mais no funil, mas o histórico fica salvo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Resultado</dt>
            <dd className="text-sm font-medium">{DEAL_STATUS_LABELS[status]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Valor final</dt>
            <dd className="text-sm font-medium">{formatCurrencyBR(value)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Fechado em</dt>
            <dd className="text-sm">{formatDateBR(closedAt)}</dd>
          </div>
          {status === "LOST" && (
            <div>
              <dt className="text-xs text-muted-foreground">Motivo</dt>
              <dd className="text-sm">{lostReasonName ?? "—"}</dd>
            </div>
          )}
        </dl>
        {lostNote && (
          <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            {lostNote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function DealTasksCard({ tasks }: { tasks: DealTask[] }) {
  const open = tasks.filter((task) => task.completedAt === null);
  const completed = tasks.filter((task) => task.completedAt !== null).slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarefas</CardTitle>
        <CardDescription>A próxima ação e o histórico recente.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa registrada.</p>
        )}

        {open.length > 0 && (
          <ul className="flex flex-col gap-2">
            {open.map((task) => (
              <li key={task.id} className="rounded-lg border border-border px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{task.title}</p>
                  <Badge variant="secondary">{TASK_TYPE_LABELS[task.type]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Para {formatDateBR(task.dueAt)} · {task.ownerName}
                </p>
              </li>
            ))}
          </ul>
        )}

        {completed.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Concluídas
            </p>
            <ul className="flex flex-col gap-2">
              {completed.map((task) => (
                <li
                  key={task.id}
                  className="rounded-lg bg-muted/40 px-3 py-2 text-muted-foreground"
                >
                  <p className="text-sm">{task.title}</p>
                  <p className="text-xs">
                    {formatDateBR(task.completedAt)}
                    {task.result ? ` · ${TASK_RESULT_LABELS[task.result]}` : ""}
                    {task.resultNote ? ` · ${task.resultNote}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DealTimelineCard({ events }: { events: DealTimelineEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico</CardTitle>
        <CardDescription>Movimentações registradas neste negócio.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento ainda.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {events.map((event) => (
              <li key={event.id} className="flex gap-3">
                <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" />
                <div className="min-w-0">
                  <p className="text-sm">{describeDealEvent(event.type, event.payload)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTimeBR(event.createdAt)}
                    {event.actorName ? ` · ${event.actorName}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export function DealNotesCard({ notes }: { notes: DealNote[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notas</CardTitle>
        <CardDescription>Registros rápidos da negociação.</CardDescription>
      </CardHeader>
      <CardContent>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma nota ainda. A captura rápida de notas chega na tarefa 008.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-sm whitespace-pre-wrap">{note.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTimeBR(note.createdAt)} · {note.authorName}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
