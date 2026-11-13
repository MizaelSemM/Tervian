"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { trackEvent } from "@/lib/analytics";
import { normalizePhoneBR } from "@/lib/phone";
import { publicFormPath } from "@/lib/public-form";
import { runWithTenant } from "@/lib/tenant-context";
import { AppError } from "@/server/errors";
import { createLead } from "@/server/services/leads";
import { loadPublicFormAccount, resolvePublicFormOwner } from "@/server/services/public-form";
import { logEvent } from "@/server/services/timeline";

type RateBucket = { count: number; resetAt: number };
const RATE_LIMIT = new Map<string, RateBucket>();

// Limite em memória (por instância). Na Vercel cada instância tem seu mapa; é
// suficiente para spam básico e pode ser trocado por Redis/Upstash na 015.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MIN_FILL_MS = 1500;

function getClientIp(headerStore: Awaited<ReturnType<typeof headers>>): string {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headerStore.get("x-real-ip") || "unknown";
}

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = RATE_LIMIT.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    RATE_LIMIT.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
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

  // Honeypot: bots costumam preencher todos os campos.
  const honeypot = String(formData.get("website") ?? "").trim();
  if (honeypot) return { success: true };

  // Bot que envia no mesmo instante em que a página abriu.
  const startedAt = Number(formData.get("startedAt"));
  const elapsedMs = Number.isFinite(startedAt) && startedAt > 0 ? Date.now() - startedAt : null;
  if (elapsedMs !== null && elapsedMs < MIN_FILL_MS) return { success: true };

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

  // Revalida o link público (pode ter sido desativado depois da página aberta).
  const account = await loadPublicFormAccount(slug);
  if (!account) return { error: "Formulário indisponível no momento." };

  const owner = await resolvePublicFormOwner(account.id, account.ownerId);
  if (!owner) return { error: "Formulário indisponível no momento." };

  const captureSeconds = elapsedMs !== null ? Math.round(elapsedMs / 1000) : undefined;

  try {
    await runWithTenant({ accountId: account.id, userId: owner.id }, async () => {
      const result = await createLead({
        actingUser: { id: owner.id, role: "ADMIN" },
        name,
        phone,
        email,
        origin: "FORM",
        source: "form",
        ownerId: owner.id,
        captureSeconds,
      });

      await logEvent({
        type: "lead.captured_form",
        payload: {
          utmSource,
          utmMedium,
          utmCampaign,
          duplicate: result.status === "duplicate",
        },
        contactId: result.status === "duplicate" ? result.contact.id : result.contactId,
        actorId: owner.id,
      });

      trackEvent("lead_captured", {
        origin: "FORM",
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        seconds: captureSeconds,
        duplicate: result.status === "duplicate",
      });
    });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    console.error("[formulario-publico] Erro ao criar lead:", error);
    return { error: "Não foi possível enviar agora. Tente novamente." };
  }

  redirect(`${publicFormPath(account.slug)}?enviado=1`);
}
