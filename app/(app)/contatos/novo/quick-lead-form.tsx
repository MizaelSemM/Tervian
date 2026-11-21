"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhoneBR, maskPhoneInput } from "@/lib/phone";
import { CONTACT_ORIGIN_LABELS, MANUAL_ORIGINS, type ContactOrigin } from "@/lib/schemas/contact";

import { createContactAction, type CreateContactFormState } from "../actions";

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * Formulário de captura rápida (US-03).
 *
 * - Nome + telefone em primeiro plano (o resto fica em "Mais detalhes").
 * - Máscara é só UX; o servidor normaliza para E.164 e valida de novo.
 * - Duplicado não é erro: mostra o contato existente e o link para abri-lo.
 */
export function QuickLeadForm({
  owners,
  canAssignOwner,
  defaultOwnerId,
  startedAt,
}: {
  owners: Array<{ id: string; name: string }>;
  canAssignOwner: boolean;
  defaultOwnerId: string;
  startedAt: number;
}) {
  const [state, formAction, pending] = useActionState<CreateContactFormState, FormData>(
    createContactAction,
    null,
  );
  const [phone, setPhone] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quem é o novo lead?</CardTitle>
        <CardDescription>
          O telefone é a chave única da conta: se já existir, avisamos antes de duplicar.
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="flex flex-col gap-5">
          <input type="hidden" name="startedAt" value={startedAt} />

          {state?.duplicate && (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-3 text-sm"
            >
              <p className="font-medium">
                {state.duplicate.deleted
                  ? "Este telefone pertence a um contato excluído."
                  : "Este telefone já está cadastrado."}
              </p>
              <p className="text-muted-foreground">
                {state.duplicate.name}, {formatPhoneBR(state.duplicate.phone)}
              </p>
              {!state.duplicate.deleted && (
                <Link
                  href={`/contatos/${state.duplicate.id}`}
                  className={buttonVariants({ size: "sm", className: "self-start" })}
                >
                  Abrir contato existente
                </Link>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="lead-name">Nome</Label>
            <Input
              id="lead-name"
              name="name"
              placeholder="Ex.: Carla Mendes"
              autoComplete="off"
              autoFocus
              required
              maxLength={80}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lead-phone">Telefone</Label>
            <Input
              id="lead-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="done"
              placeholder="(11) 98765-4321"
              value={phone}
              onChange={(event) => setPhone(maskPhoneInput(event.target.value))}
              required
            />
            <p className="text-xs text-muted-foreground">
              Com DDD. Pode colar com +55 que a gente ajusta.
            </p>
          </div>

          <details className="rounded-lg border border-border px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">
              Mais detalhes (opcional)
            </summary>
            <div className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="lead-email">E-mail</Label>
                <Input
                  id="lead-email"
                  name="email"
                  type="email"
                  placeholder="pessoa@empresa.com"
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="lead-company">Empresa</Label>
                <Input
                  id="lead-company"
                  name="companyText"
                  placeholder="Onde essa pessoa trabalha"
                  autoComplete="off"
                  maxLength={120}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="lead-origin">Origem</Label>
                <select
                  id="lead-origin"
                  name="origin"
                  defaultValue="OTHER"
                  className={selectClassName}
                >
                  {MANUAL_ORIGINS.map((origin: ContactOrigin) => (
                    <option key={origin} value={origin}>
                      {CONTACT_ORIGIN_LABELS[origin]}
                    </option>
                  ))}
                </select>
              </div>

              {canAssignOwner && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="lead-owner">Responsável</Label>
                  <select
                    id="lead-owner"
                    name="ownerId"
                    defaultValue={defaultOwnerId}
                    className={selectClassName}
                  >
                    {owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </details>

          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? "Salvando…" : "Salvar lead"}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
