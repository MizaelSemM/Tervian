import { withSession, type AuthedSession } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
import { getToday } from "@/server/services/followup";
import { listMessageTemplates } from "@/server/services/message-templates";
import type { ActingUser } from "@/server/services/owners";

import { TodayView } from "./today-view";

export const metadata = { title: "Hoje — Tervian" };

type HojeSearchParams = {
  vendedor?: string;
};

function actingUserFrom(session: AuthedSession): ActingUser {
  return {
    id: session.user.id,
    role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
  };
}

/** Tela inicial do app: o que fazer agora (US-01/RF-30). */
export default async function HojePage({
  searchParams,
}: {
  searchParams: Promise<HojeSearchParams>;
}) {
  const params = await searchParams;

  return withSession(async (session) => {
    const [data, messageTemplates] = await Promise.all([
      getToday({
        actingUser: actingUserFrom(session),
        ownerId: params.vendedor ?? null,
      }),
      listMessageTemplates(),
    ]);
    const firstName = session.user.name.trim().split(/\s+/)[0] || session.user.name;

    trackEvent("today_viewed", { is_admin: session.user.role === "ADMIN" });

    return (
      <TodayView
        data={data}
        firstName={firstName}
        sellerName={session.user.name}
        isAdmin={session.user.role === "ADMIN"}
        messageTemplates={messageTemplates}
      />
    );
  });
}
