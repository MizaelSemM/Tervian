"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signUpCompanyAction, type SignUpFormState } from "./actions";

/**
 * Cadastro de empresa — passa por Server Action (é o único fluxo que cria a
 * conta/tenant; ver server/signup.ts). No sucesso, o action redireciona
 * já logado (o Better Auth cria a sessão no cadastro).
 */
export function SignUpForm() {
  const [state, formAction, pending] = useActionState<SignUpFormState, FormData>(
    signUpCompanyAction,
    null,
  );

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em]">Criar conta</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Crie a conta da sua empresa e comece pelo plano gratuito.
        </p>
      </header>

      <form action={formAction} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="companyName" className="text-[13px] font-medium">
            Nome da empresa
          </Label>
          <Input
            id="companyName"
            name="companyName"
            autoComplete="organization"
            placeholder="Ex.: Loja do Bairro"
            defaultValue={state?.values?.companyName}
            className="h-11"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="name" className="text-[13px] font-medium">
            Seu nome
          </Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder="Nome e sobrenome"
            defaultValue={state?.values?.name}
            className="h-11"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-[13px] font-medium">
            E-mail
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            defaultValue={state?.values?.email}
            className="h-11"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password" className="text-[13px] font-medium">
            Senha
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo de 8 caracteres"
            className="h-11"
            required
          />
        </div>

        <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            name="acceptTerms"
            className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
            required
          />
          <span>
            Li e aceito os{" "}
            <Link
              href="/termos"
              target="_blank"
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
              rel="noopener noreferrer"
            >
              termos de uso
            </Link>{" "}
            e a{" "}
            <Link
              href="/privacidade"
              target="_blank"
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
              rel="noopener noreferrer"
            >
              política de privacidade
            </Link>
            .
          </span>
        </label>

        {state?.error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        )}

        <Button type="submit" className="mt-1 h-11 w-full" disabled={pending}>
          {pending ? "Criando conta…" : "Criar conta"}
        </Button>

        <p className="text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
