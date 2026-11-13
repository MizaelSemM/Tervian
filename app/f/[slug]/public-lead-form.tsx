"use client";

import { useActionState, useEffect, useRef } from "react";

import { submitPublicLeadAction, type PublicLeadState } from "./actions";

export function PublicLeadForm({
  slug,
  thankYouMessage,
  whatsappUrl,
  utmSource,
  utmMedium,
  utmCampaign,
}: {
  slug: string;
  thankYouMessage: string;
  whatsappUrl: string | null;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}) {
  const startedAtRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState<PublicLeadState, FormData>(
    (previous, formData) => submitPublicLeadAction(slug, previous, formData),
    null,
  );

  useEffect(() => {
    if (startedAtRef.current) startedAtRef.current.value = String(Date.now());
  }, []);

  if (state?.success) {
    return (
      <div className="rounded-2xl border border-border bg-background p-6 text-center">
        <h2 className="text-2xl font-semibold">Recebemos seu contato</h2>
        <p className="mt-2 text-muted-foreground">{thankYouMessage}</p>
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-5 text-base font-medium text-primary-foreground"
          >
            Falar no WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input ref={startedAtRef} type="hidden" name="startedAt" defaultValue="" />
      <input type="hidden" name="utm_source" value={utmSource ?? ""} />
      <input type="hidden" name="utm_medium" value={utmMedium ?? ""} />
      <input type="hidden" name="utm_campaign" value={utmCampaign ?? ""} />

      {/* Honeypot */}
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Nome</span>
        <input
          name="name"
          required
          autoComplete="name"
          className="h-12 rounded-xl border border-input bg-transparent px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Telefone</span>
        <input
          name="phone"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className="h-12 rounded-xl border border-input bg-transparent px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">E-mail (opcional)</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          className="h-12 rounded-xl border border-input bg-transparent px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
      </label>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-primary text-base font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Enviando..." : "Quero falar"}
      </button>
    </form>
  );
}
