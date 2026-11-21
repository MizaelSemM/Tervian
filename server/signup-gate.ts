import { env } from "@/lib/env";
import { AppError } from "@/server/errors";

/**
 * Interruptores operacionais do cadastro de novas empresas.
 *
 * A flag `SIGNUPS_ENABLED` vale SÓ para criar uma conta/tenant nova: login,
 * redefinição de senha e aceite de convite não passam por aqui (quem já tem
 * acesso continua normalmente). A UI pergunta `areSignupsOpen()`; a Server
 * Action e o serviço chamam `assertSignupsOpen()` — esconder o formulário é
 * cosmético, o bloqueio real tem que estar no servidor.
 */
export const SIGNUPS_CLOSED_MESSAGE =
  "Cadastros temporariamente fechados. Se você já tem conta, entre normalmente.";

export function areSignupsOpen(): boolean {
  return env.SIGNUPS_ENABLED;
}

/** Chamado no servidor antes de qualquer escrita de cadastro. */
export function assertSignupsOpen(): void {
  if (!areSignupsOpen()) {
    throw new AppError("SIGNUPS_CLOSED", SIGNUPS_CLOSED_MESSAGE);
  }
}
