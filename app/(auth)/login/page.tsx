import { Suspense } from "react";

import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar — Tervian" };

/**
 * Login (RF-01). Shell estático + formulário client suspenso (o formulário lê
 * `?redirect=` com `useSearchParams`, que exige um boundary de Suspense para a
 * página continuar pré-renderizável — ver guia de auth + Cache Components).
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
      <LoginForm />
    </Suspense>
  );
}
