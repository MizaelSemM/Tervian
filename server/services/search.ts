import { ownerScope } from "@/lib/access";
import { whatsappLinkBR } from "@/lib/phone";
import { requireTenantContext } from "@/lib/tenant-context";
import { tenantDb } from "@/lib/tenant-prisma";
import type { ActingUser } from "@/server/services/owners";

export type SearchResultDeal = {
  id: string;
  title: string;
  status: "OPEN" | "WON" | "LOST";
  nextActionAt: Date | null;
};

export type SearchResult = {
  contact: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    companyText: string | null;
    ownerName: string | null;
  };
  deals: SearchResultDeal[];
  whatsappUrl: string | null;
};

export async function searchContacts(input: {
  actingUser: ActingUser;
  query: string;
  limit?: number;
}): Promise<SearchResult[]> {
  const db = tenantDb();
  requireTenantContext();

  const query = input.query.trim();
  if (query.length < 2) return [];

  const digits = query.replace(/\D/g, "");
  const where = {
    deletedAt: null,
    ...ownerScope(input.actingUser),
    OR: [
      { name: { contains: query, mode: "insensitive" as const } },
      ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : []),
      ...(query.includes("@")
        ? [{ email: { contains: query, mode: "insensitive" as const } }]
        : []),
    ],
  };

  const rows = await db.contact.findMany({
    where,
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    take: Math.min(10, Math.max(1, input.limit ?? 8)),
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      companyText: true,
      owner: { select: { name: true } },
      deals: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          title: true,
          status: true,
          nextActionAt: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    contact: {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      companyText: row.companyText,
      ownerName: row.owner?.name ?? null,
    },
    deals: row.deals.map((deal) => ({
      id: deal.id,
      title: deal.title,
      status: deal.status,
      nextActionAt: deal.nextActionAt,
    })),
    whatsappUrl: whatsappLinkBR(row.phone),
  }));
}
