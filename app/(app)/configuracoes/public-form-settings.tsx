"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";

import { QrCode } from "@/components/qr-code";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PUBLIC_FORM_DEFAULT_DESCRIPTION,
  PUBLIC_FORM_MESSAGE_MAX,
  PUBLIC_FORM_SLUG_MAX,
  PUBLIC_FORM_TITLE_MAX,
  publicFormEmbedSnippet,
  publicFormUrl,
} from "@/lib/public-form";
import type { PublicFormSettings } from "@/server/services/public-form";

import { updatePublicFormSettingsAction, type PublicFormSettingsState } from "./actions";

const fieldClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado.`);
  } catch {
    toast.error("Não foi possível copiar. Selecione o texto manualmente.");
  }
}

export function PublicFormSettingsForm({
  settings,
  owners,
  baseUrl,
}: {
  settings: PublicFormSettings;
  owners: Array<{ id: string; name: string; role: "ADMIN" | "SELLER" }>;
  baseUrl: string;
}) {
  const [state, formAction, pending] = useActionState<PublicFormSettingsState, FormData>(
    updatePublicFormSettingsAction,
    null,
  );
  const [enabled, setEnabled] = useState(settings.enabled);
  const [slug, setSlug] = useState(settings.slug);
  const [title, setTitle] = useState(settings.title);
  const [message, setMessage] = useState(settings.message);

  // `BETTER_AUTH_URL` é a URL pública canônica do app; usar window aqui
  // divergiria em previews da Vercel (link copiado apontaria para o preview).
  const origin = baseUrl;
  const url = publicFormUrl(slug.trim() || settings.slug, origin);
  const embed = publicFormEmbedSnippet(url);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Formulário público</CardTitle>
          <CardDescription>
            Use este link na bio do Instagram ou embuta o formulário no seu site. O lead cai na tela
            “Hoje” do responsável escolhido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-5" noValidate>
            <label className="flex items-start gap-3 rounded-lg border border-border p-3">
              <input
                type="checkbox"
                name="enabled"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                className="mt-1"
              />
              <span className="text-sm">
                <span className="font-medium">Formulário ativo</span>
                <span className="block text-muted-foreground">
                  Desativado, o link retorna 404 (nenhum lead é perdido; só deixa de aceitar).
                </span>
              </span>
            </label>

            <div className="flex flex-col gap-2">
              <Label htmlFor="public-form-slug">Link do formulário</Label>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-muted-foreground">{origin}/f/</span>
                <Input
                  id="public-form-slug"
                  name="slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  maxLength={PUBLIC_FORM_SLUG_MAX}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Só letras sem acento, números e hífen. O link antigo pelo id da conta continua
                funcionando.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="public-form-title">Título</Label>
              <Input
                id="public-form-title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={PUBLIC_FORM_TITLE_MAX}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="public-form-message">Mensagem de agradecimento</Label>
              <textarea
                id="public-form-message"
                name="message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={PUBLIC_FORM_MESSAGE_MAX}
                rows={3}
                className={`${fieldClass} h-auto py-2`}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="public-form-whatsapp">WhatsApp da empresa (opcional)</Label>
                <Input
                  id="public-form-whatsapp"
                  name="whatsapp"
                  type="tel"
                  defaultValue={settings.whatsapp ?? ""}
                  placeholder="(11) 98765-4321"
                />
                <p className="text-xs text-muted-foreground">
                  Mostra o botão “Falar no WhatsApp” depois do envio.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="public-form-owner">Responsável pelos leads</Label>
                <select
                  id="public-form-owner"
                  name="ownerId"
                  defaultValue={settings.ownerId ?? ""}
                  className={fieldClass}
                >
                  <option value="">Primeiro usuário ativo (padrão)</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name}
                      {owner.role === "ADMIN" ? " (admin)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {state?.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
            {state?.success && (
              <p role="status" className="text-sm text-emerald-600">
                Configurações salvas. O formulário já está atualizado.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando…" : "Salvar configurações"}
              </Button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                Abrir formulário
              </a>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Prévia ao vivo</CardTitle>
            <CardDescription>Como o cliente vê no celular.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-center text-xs font-medium text-muted-foreground">
                {settings.accountName}
              </p>
              <p className="mt-1 text-center text-lg font-semibold leading-tight">
                {title || "Título do formulário"}
              </p>
              <p className="mt-1 text-center text-xs text-muted-foreground">
                {PUBLIC_FORM_DEFAULT_DESCRIPTION}
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {["Nome", "Telefone", "E-mail (opcional)"].map((field) => (
                  <div key={field} className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium">{field}</span>
                    <span className="h-8 rounded-lg border border-input bg-muted/40" />
                  </div>
                ))}
                <span className="mt-1 flex h-9 items-center justify-center rounded-lg bg-primary text-xs font-medium text-primary-foreground">
                  Quero falar
                </span>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-dashed border-border p-3">
              <p className="text-[11px] font-medium text-muted-foreground">Depois de enviar</p>
              <p className="mt-1 text-xs">{message || "Mensagem de agradecimento"}</p>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>QR code para a bio</CardTitle>
            <CardDescription>Baixe ou escaneie para testar o link.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <QrCode value={url} size={168} />
            <code className="w-full break-all rounded-lg bg-muted px-3 py-2 text-center text-xs">
              {url}
            </code>
            <div className="flex w-full flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyText(url, "Link")}
              >
                Copiar link
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyText(embed, "Snippet")}
              >
                Copiar embed
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Embutir no site</CardTitle>
            <CardDescription>Cole o HTML onde o formulário deve aparecer.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-32 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">
              <code>{embed}</code>
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
