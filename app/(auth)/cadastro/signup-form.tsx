"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Crie a conta da sua empresa e comece pelo plano gratuito.</CardDescription>
      </CardHeader>
      <form action={formAction} noValidate>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="companyName">Nome da empresa</Label>
            <Input
              id="companyName"
              name="companyName"
              autoComplete="organization"
              placeholder="Ex.: Loja do Bairro"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Seu nome</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              placeholder="Nome e sobrenome"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="voce@empresa.com"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              required
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="acceptTerms" className="mt-0.5" required />
            <span>
              Li e aceito os{" "}
              <Link
                href="/termos"
                target="_blank"
                className="underline underline-offset-4"
                rel="noopener noreferrer"
              >
                termos de uso
              </Link>{" "}
              e a{" "}
              <Link
                href="/privacidade"
                target="_blank"
                className="underline underline-offset-4"
                rel="noopener noreferrer"
              >
                política de privacidade
              </Link>
              .
            </span>
          </label>
          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Criando conta…" : "Criar conta"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/login" className="underline underline-offset-4">
              Entrar
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
