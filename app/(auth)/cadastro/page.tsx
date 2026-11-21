import { areSignupsOpen } from "@/server/signup-gate";

import { SignUpClosed } from "./signup-closed";
import { SignUpForm } from "./signup-form";

export const metadata = { title: "Criar conta — Tervian" };

/**
 * Cadastro de empresa (RF-01): cria a conta + o administrador.
 * Com `SIGNUPS_ENABLED=false`, mostra só o aviso e o caminho de volta ao login.
 */
export default function SignUpPage() {
  if (!areSignupsOpen()) return <SignUpClosed />;

  return <SignUpForm />;
}
