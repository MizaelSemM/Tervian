"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { sanitizeRedirectPath } from "@/lib/safe-redirect";
import { firstIssueMessage, loginSchema } from "@/lib/schemas/auth";

/**
 * Formulário de login — chama `authClient.signIn.email` (requisição do
 * NAVEGADOR para /api/auth, que passa pelo rate limit do Better Auth).
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirectPath(searchParams.get("redirect"));

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error));
      return;
    }

    setPending(true);
    const { error: signInError } = await authClient.signIn.email({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (signInError) {
      setPending(false);
      if (signInError.status === 429) {
        setError("Muitas tentativas de login. Aguarde um minuto e tente novamente.");
      } else if (signInError.status === 403 && signInError.message) {
        // Usuário desativado (mensagem do nosso hook — lib/auth.ts).
        setError(signInError.message);
      } else {
        // Mensagem neutra: não revela se o e-mail existe.
        setError("E-mail ou senha inválidos.");
      }
      return;
    }

    // Navegação HARD após o login: o Next pode ter pré-carregado `/` antes da
    // sessão existir e o router client-side reutilizar o payload antigo (que
    // redireciona de volta para /login). O reload garante cookie + cache limpos.
    window.location.assign(redirectTo);
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em]">Entrar</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Acesse o painel da sua equipe.</p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
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
            className="h-11"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password" className="text-[13px] font-medium">
              Senha
            </Label>
            <Link
              href="/esqueci-senha"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              Esqueci a senha
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="h-11"
            required
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <Button type="submit" className="mt-1 h-11 w-full" disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </Button>

        <p className="text-sm text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link
            href="/cadastro"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Criar conta
          </Link>
        </p>
      </form>
    </div>
  );
}
