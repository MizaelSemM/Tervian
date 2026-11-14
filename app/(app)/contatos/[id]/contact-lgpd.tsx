"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { purgeContactAction } from "../actions";

/**
 * Direitos do titular (LGPD, tarefa 013): exportar os dados do contato e, para
 * ADMIN, excluir definitivamente. A exclusão lógica do dia a dia continua no
 * painel de edição; aqui é a remoção irreversível com confirmação digitada.
 */
export function ContactLgpdCard({
  contactId,
  contactName,
  isAdmin,
}: {
  contactId: string;
  contactName: string;
  isAdmin: boolean;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handlePurge() {
    startTransition(async () => {
      const result = await purgeContactAction(contactId, confirmation);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Dados do contato removidos definitivamente.");
      router.push("/contatos?excluido=1");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacidade e dados (LGPD)</CardTitle>
        <CardDescription>
          Atenda pedidos do titular: exporte tudo o que guardamos ou elimine definitivamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Exportar dados</p>
            <p className="text-xs text-muted-foreground">
              Contato, negócios, tarefas, notas e histórico em JSON.
            </p>
          </div>
          <a
            href={`/api/lgpd/export?contato=${encodeURIComponent(contactId)}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Baixar JSON
          </a>
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4">
            <div>
              <p className="text-sm font-medium text-destructive">Excluir definitivamente</p>
              <p className="text-xs text-muted-foreground">
                Apaga {contactName}, seus negócios, tarefas, notas e histórico. Não há como
                desfazer. A ação fica registrada na auditoria da conta sem os dados pessoais.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:max-w-xs">
              <Label htmlFor="lgpd-confirmation">
                Digite <span className="font-mono font-semibold">EXCLUIR</span> para confirmar
              </Label>
              <Input
                id="lgpd-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                disabled={pending}
              />
            </div>
            <div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pending || confirmation.trim().toUpperCase() !== "EXCLUIR"}
                onClick={handlePurge}
              >
                {pending ? "Excluindo…" : "Excluir dados definitivamente"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
