import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Contexto de cadastro (tarefa 003).
 *
 * O Better Auth cria usuários por conta própria (endpoint `/sign-up/email`). Como
 * no Tervian todo usuário pertence a uma conta (`User.accountId` NOT NULL) e o
 * papel (`role`) é controlado pelo servidor, o cadastro só pode acontecer por
 * dois fluxos NOSSOS:
 *
 *  1. criação de empresa (cadastro) — primeiro usuário vira ADMIN;
 *  2. aceite de convite — usuário entra com o papel do convite (RF-04).
 *
 * Os dois fluxos abrem este contexto com `runWithSignupContext()` e chamam
 * `auth.api.signUpEmail()` dentro dele. O hook `databaseHooks.user.create.before`
 * (lib/auth.ts) lê o contexto e injeta `accountId`/`role` no usuário — e REJEITA
 * qualquer cadastro que chegue sem contexto (chamada direta ao endpoint público).
 */
export type SignupContext = {
  /** Conta (tenant) que o novo usuário vai integrar. Escolhida pelo servidor. */
  accountId: string;
  /** Papel do usuário: ADMIN (criação de empresa) ou o papel do convite. */
  role: "ADMIN" | "SELLER";
};

const storage = new AsyncLocalStorage<SignupContext>();

/** Executa `fn` com o contexto de cadastro ativo (propaga por promises/async). */
export function runWithSignupContext<T>(context: SignupContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Contexto de cadastro atual, ou undefined (ex.: endpoint chamado direto). */
export function getSignupContext(): SignupContext | undefined {
  return storage.getStore();
}
