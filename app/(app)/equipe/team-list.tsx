"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { deactivateUserAction, reactivateUserAction, type UserActionState } from "./actions";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SELLER";
  active: boolean;
  isSelf: boolean;
};

/** Lista de pessoas com acesso + desativar/reativar (sem apagar histórico). */
export function TeamList({ members }: { members: TeamMember[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">Pessoas com acesso</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {member.name}
                {member.isSelf && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(você)</span>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">{member.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="secondary">{member.role === "ADMIN" ? "Admin" : "Vendedor"}</Badge>
              {!member.active && <Badge variant="outline">Desativado</Badge>}
              {!member.isSelf && <MemberToggle member={member} />}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MemberToggle({ member }: { member: TeamMember }) {
  const action = member.active ? deactivateUserAction : reactivateUserAction;
  const [state, formAction, pending] = useActionState<UserActionState, FormData>(action, null);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="userId" value={member.id} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Salvando…" : member.active ? "Desativar" : "Reativar"}
      </Button>
      {state?.error && (
        <p role="alert" className="max-w-56 text-right text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
