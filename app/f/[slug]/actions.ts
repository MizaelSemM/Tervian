"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { runWithTenant } from "@/lib/tenant-context";
import { createTenantClient } from "@/lib/tenant-prisma";
import { AppError } from "@/server/errors";
import { createLead } from "@/server/services/leads";
import { logEvent } from "@/server/services/timeline";
import { normalizePhoneBR } from "@/lib/phone";

type RateBucket = { count: number; resetAt: number };
const RATE_LIMIT = new Map<string, RateBucket>();

function getClientIp(headerStore: Awaited<ReturnType<typeof headers>>): string {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headerStore.get("x-real-ip") || "unknown";
}

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = RATE_LIMIT.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    RATE_LIMIT.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  if (bucket.count >= 5) return false;
  bucket.count += 1;
  return true;
}

export type PublicLeadState = { error?: string; success?: boolean } | null;

export async function submitPublicLeadAction(
  slug: string,
  _previous: PublicLeadState,
  formData: FormData,
): Promise<PublicLeadState> {
  const headerStore = await headers();
  const ip = getClientIp(headerStore);

  // Honeypot: bots usually fill every field.
  const honeypot = String(formData.get("website") ?? "").trim();
  if (honeypot) return { success: true };

  const startedAt = Number(formData.get("startedAt"));
  if (Number.isFinite(startedAt) && Date.now() - startedAt < 1500) {
    return { success: true };
  }

  if (!rateLimit(ip)) {
    return { error: "Muitas tentativas. Tente novamente em alguns minutos." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const utmSource = String(formData.get("utm_source") ?? "").trim() || null;
  const utmMedium = String(formData.get("utm_medium") ?? "").trim() || null;
  const utmCampaign = String(formData.get("utm_campaign") ?? "").trim() || null;

  if (name.length < 2) return { error: "Informe seu nome." };
  if (!normalizePhoneBR(phone)) return { error: "Informe um telefone válido." };

  const db = createTenantClient(slug);
  const owner = await db.user.findFirst({
    where: { active: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  if (!owner) return { error: "Formulário indisponível no momento." };

  try {
    await runWithTenant({ accountId: slug, userId: owner.id }, async () => {
      const result = await createLead({
        actingUser: { id: owner.id, role: "ADMIN" },
        name,
        phone,
        email,
        origin: "FORM",
        source: "form",
        ownerId: owner.id,
      });

      await logEvent({
        type: "lead.captured_form",
        payload: {
          utmSource,
          utmMedium,
          utmCampaign,
          duplicate: result.status === "duplicate",
        },
        contactId: result.status === "created" ? result.contactId : result.contact.id,
        actorId: owner.id,
      });
    });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    console.error("[formulario-publico] Erro ao criar lead:", error);
    return { error: "Não foi possível enviar agora. Tente novamente." };
  }

  redirect(`/f/${slug}?enviado=1`);
}
