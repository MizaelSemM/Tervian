"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";

import { revokeInviteAction, type UserActionState } from "./actions";

export type PendingInvite = {
  id: string;
  email: string;
  role: "ADMIN" | "SELLER";
  url: string;
  expiresInDays: number;
};

/** Convites aguardando resposta, com copiar link e cancelar. */
export function PendingInvites({ invites }: { invites: PendingInvite[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">Convites pendentes</h2>
      {invites.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum convite aguardando resposta.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {invites.map((invite) => (
            <li key={invite.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{invite.email}</p>
                <p className="text-xs text-muted-foreground">
                  {invite.role === "ADMIN" ? "Admin" : "Vendedor"}, expira em{" "}
                  {invite.expiresInDays === 1 ? "1 dia" : `${invite.expiresInDays} dias`}
                </p>
              </div>
              <InviteRowActions invite={invite} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InviteRowActions({ invite }: { invite: PendingInvite }) {
  const [state, formAction, pending] = useActionState<UserActionState, FormData>(
    revokeInviteAction,
    null,
  );
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copyLink}>
          {copied ? "Copiado!" : "Copiar link"}
        </Button>
        <form action={formAction}>
          <input type="hidden" name="inviteId" value={invite.id} />
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            {pending ? "Cancelando…" : "Cancelar"}
          </Button>
        </form>
      </div>
      {state?.error && (
        <p role="alert" className="text-right text-xs text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}
