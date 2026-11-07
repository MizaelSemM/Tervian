"use server";

import { withSession, type AuthedSession } from "@/lib/session";
import { searchContacts, type SearchResult } from "@/server/services/search";
export type { SearchResult };
import type { ActingUser } from "@/server/services/owners";

function actingUserFrom(session: AuthedSession): ActingUser {
  return {
    id: session.user.id,
    role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
  };
}

export async function searchContactsAction(query: string): Promise<SearchResult[]> {
  return withSession(async (session) => {
    return searchContacts({ actingUser: actingUserFrom(session), query });
  });
}
