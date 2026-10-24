import { withAdmin } from "@/lib/session";
import { listPendingInvites } from "@/server/invites";
import { listTeam } from "@/server/team";

import { InviteForm } from "./invite-form";
import { PendingInvites } from "./pending-invites";
import { TeamList } from "./team-list";

export const metadata = { title: "Equipe — Tervian" };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Gestão de equipe (RF-02/RF-03/RF-04) — só ADMIN. O `withAdmin` valida a
 * sessão de verdade e abre o contexto de tenant (services usam `tenantDb()`).
 */
export default async function TeamPage() {
  return withAdmin(async (session) => {
    const [team, invites] = await Promise.all([listTeam(), listPendingInvites()]);
    const now = Date.now();

    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
          <p className="text-muted-foreground">
            Convide pessoas, acompanhe quem tem acesso e desative quem saiu (o histórico fica).
          </p>
        </div>

        <TeamList
          members={team.map((member) => ({
            id: member.id,
            name: member.name,
            email: member.email,
            role: member.role,
            active: member.active,
            isSelf: member.id === session.user.id,
          }))}
        />

        <InviteForm />

        <PendingInvites
          invites={invites.map((invite) => ({
            id: invite.id,
            email: invite.email,
            role: invite.role,
            url: invite.url,
            expiresInDays: Math.max(0, Math.ceil((invite.expiresAt.getTime() - now) / DAY_MS)),
          }))}
        />
      </div>
    );
  });
}
