import { Suspense } from "react";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Redefinir senha — Tervian" };

/**
 * Redefinição de senha (RF-01). O link do e-mail passa pelo Better Auth
 * (`/api/auth/reset-password/:token`) que redireciona para cá com `?token=`.
 * O formulário lê os parâmetros no client (sob Suspense) e chama
 * `authClient.resetPassword`.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-muted" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
