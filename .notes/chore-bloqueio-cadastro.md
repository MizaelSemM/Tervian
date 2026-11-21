# Chore · Bloqueio de novos cadastros

Branch: `chore/bloqueio-cadastro`
Status: em revisão (PR para `master`)
Decisão: 21/11/2026

## Objetivo

Fechar temporariamente a criação de **novas contas/empresas** sem afetar quem já tem login. O controle é uma variável de ambiente, para poder abrir/fechar sem editar código.

## Decisões

- `SIGNUPS_ENABLED` em `lib/env.ts`: `z.enum(["true", "false"]).default("true").transform(...)`. Padrão `true` para não mudar o comportamento de quem não configurar a variável; documentada em `.env.example`.
- `false` afeta **somente** o cadastro de empresa: `/cadastro` mostra aviso com link para `/login`, a Server Action devolve mensagem amigável e `signUpCompany()` lança `AppError("SIGNUPS_CLOSED")` antes de qualquer escrita no banco.
- Login, reset de senha e aceite de convite não passam pelo gate — administradores de contas existentes continuam convidando colegas, e ninguém perde acesso.
- A checagem existe em três camadas (página, action, serviço) porque esconder o formulário não é segurança: action é endpoint público e o serviço pode ser chamado de fora da UI.
- Trocar a variável na Vercel exige **redeploy** (o valor é lido no servidor no build/start). Em dev, basta reiniciar `next dev` após editar `.env`.

## Como operar

- Fechar: `SIGNUPS_ENABLED="false"` → redeploy.
- Reabrir: `SIGNUPS_ENABLED="true"` (ou remover a variável) → redeploy.

## Critérios de aceite

- [x] Com a flag `false`, `/cadastro` não renderiza formulário e mostra aviso + link para `/login`.
- [x] Com a flag `false`, POST direto na Server Action não cria conta e devolve mensagem em pt-BR.
- [x] Com a flag `false`, `signUpCompany()` não consulta/escreve no banco.
- [x] Login, reset e convites seguem intactos.
- [x] Variável validada, documentada e coberta por testes unitários.
- [x] `format:check`, `lint`, `typecheck`, `build` e 126 testes unitários verdes.
- [ ] `npm test` completo: os testes de integração falharam localmente com `Authentication failed against the database server` (credenciais do `.env` local inválidas); nenhuma falha veio desta mudança. Conferir no CI, onde o Postgres é efêmero.
