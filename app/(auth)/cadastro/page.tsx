import { SignUpForm } from "./signup-form";

export const metadata = { title: "Criar conta — Tervian" };

/** Cadastro de empresa (RF-01): cria a conta + o administrador. */
export default function SignUpPage() {
  return <SignUpForm />;
}
