import { Suspense } from "react";

import { InviteCard } from "./invite-card";

export const metadata = { title: "Convite — Tervian" };

/**
 * Aceite de convite (RF-04) — página pública. A parte dinâmica (consulta do
 * convite no banco) fica sob Suspense; o token chega por params.
 */
export default function InvitePage({ params }: PageProps<"/convite/[token]">) {
  return (
    <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
      <InviteCard params={params} />
    </Suspense>
  );
}
