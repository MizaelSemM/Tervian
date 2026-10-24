import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPhoneBR, whatsappLinkBR } from "@/lib/phone";
import { DEAL_STATUS_LABELS } from "@/lib/schemas/deal";
import { withSession } from "@/lib/session";
import { daysSinceBR, formatCurrencyBR, formatDateBR, nextActionLabelBR } from "@/lib/utils";
import { getDeal } from "@/server/services/deals";
import { listLostReasons } from "@/server/services/lost-reasons";
import { listOwnerOptions, type ActingUser } from "@/server/services/owners";
import { getPipelineStages } from "@/server/services/pipeline";

import { DealClose } from "./deal-close";
import { DealEditForm } from "./deal-edit-form";
import { DealNextAction } from "./deal-next-action";
import {
  DealClosedSummary,
  DealContactCard,
  DealNotesCard,
  DealTasksCard,
  DealTimelineCard,
} from "./deal-sections";
import { DealStageSelect } from "./deal-stage-select";

export const metadata = { title: "Negócio — Tervian" };

function actingUserFromSession(session: {
  user: { id: string; role?: "ADMIN" | "SELLER" | null };
}): ActingUser {
  return {
    id: session.user.id,
    role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
  };
}

function SummaryItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export default async function DealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ novo?: string; salvo?: string; fechado?: string }>;
}) {
  const { id } = await params;
  const feedback = await searchParams;

  return withSession(async (session) => {
    const actingUser = actingUserFromSession(session);
    const deal = await getDeal({ id, actingUser });
    if (!deal) notFound();

    const isOpen = deal.status === "OPEN";
    const [stages, owners, lostReasons] = await Promise.all([
      getPipelineStages(),
      listOwnerOptions(actingUser),
      isOpen ? listLostReasons() : Promise.resolve([]),
    ]);

    const whatsapp = whatsappLinkBR(deal.contact.phone);
    const nextAction = nextActionLabelBR(deal.nextActionAt);
    const idleDays = daysSinceBR(deal.lastActivityAt ?? deal.createdAt);
    const ownerOptions = owners.some((owner) => owner.id === deal.owner.id)
      ? owners
      : [{ id: deal.owner.id, name: deal.owner.name }, ...owners];

    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Link
            href="/negocios"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Negócios
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{deal.title}</h1>
                <Badge variant={deal.status === "OPEN" ? "secondary" : "outline"}>
                  {DEAL_STATUS_LABELS[deal.status]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                <Link href={`/contatos/${deal.contact.id}`} className="hover:underline">
                  {deal.contact.name}
                </Link>{" "}
                · {formatPhoneBR(deal.contact.phone)} · {deal.owner.name}
              </p>
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
                href={`tel:${deal.contact.phone}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Ligar
              </a>
            </div>
          </div>
        </div>

        {(feedback.novo || feedback.salvo || feedback.fechado) && (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            {feedback.novo && "Negócio criado! A próxima ação já está agendada."}
            {feedback.salvo && "Negócio atualizado."}
            {feedback.fechado === "won" && "Negócio marcado como ganho. 🎉"}
            {feedback.fechado === "lost" && "Negócio marcado como perdido."}
          </p>
        )}

        <Card>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <SummaryItem label="Valor" value={formatCurrencyBR(deal.value)} />
              <SummaryItem label="Etapa" value={deal.stageName} />
              <SummaryItem label="Responsável" value={deal.owner.name} />
              <SummaryItem
                label="Previsão de fechamento"
                value={formatDateBR(deal.expectedCloseAt)}
              />
              <SummaryItem
                label={isOpen ? "Próxima ação" : "Fechado em"}
                value={isOpen ? nextAction.text : formatDateBR(deal.closedAt)}
              />
              <SummaryItem
                label="Sem atividade"
                value={
                  !isOpen
                    ? "—"
                    : idleDays === null
                      ? "—"
                      : idleDays === 0
                        ? "Ativo hoje"
                        : `${idleDays} ${idleDays === 1 ? "dia" : "dias"}`
                }
              />
            </dl>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="flex flex-col gap-6">
            {isOpen ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Etapa do funil</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DealStageSelect
                      dealId={deal.id}
                      currentStageId={deal.stageId}
                      stages={stages}
                    />
                  </CardContent>
                </Card>

                <DealEditForm
                  deal={{
                    id: deal.id,
                    title: deal.title,
                    value: deal.value,
                    ownerId: deal.owner.id,
                    expectedCloseAt: deal.expectedCloseAt,
                  }}
                  owners={ownerOptions}
                  canAssignOwner={session.user.role === "ADMIN"}
                />

                <DealNextAction dealId={deal.id} nextActionAt={deal.nextActionAt} />

                <DealClose dealId={deal.id} currentValue={deal.value} lostReasons={lostReasons} />
              </>
            ) : (
              <DealClosedSummary
                status={deal.status}
                value={deal.value}
                closedAt={deal.closedAt}
                lostReasonName={deal.lostReason?.name ?? null}
                lostNote={deal.lostNote}
              />
            )}
          </div>

          <div className="flex flex-col gap-6">
            <DealContactCard
              contact={deal.contact}
              email={deal.contactEmail}
              company={deal.contactCompany}
            />
            <DealTasksCard tasks={deal.tasks} />
            <DealTimelineCard events={deal.timeline} />
            <DealNotesCard notes={deal.notes} />
          </div>
        </div>
      </div>
    );
  });
}
