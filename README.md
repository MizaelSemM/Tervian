# Tervian — CRM de Follow-up

CRM de follow-up para pequenas equipes de vendas: o vendedor abre o app e sabe **quem chamar hoje e por quê**. O escopo completo está no [PRD](<./PRD – CRM de Follow-up para Pequenas Equipes de Vendas (MVP).md>) e o planejamento em [.notes/](./.notes/todo.md).

## Stack

| Camada    | Tecnologia                                          |
| --------- | --------------------------------------------------- |
| App       | Next.js 16 (App Router) + TypeScript                |
| UI        | Tailwind CSS 4 + shadcn/ui                          |
| Banco     | PostgreSQL (Supabase — região São Paulo) + Prisma 7 |
| Validação | Zod 4 (schemas compartilhados em `lib/schemas/`)    |
| Auth      | Better Auth (e-mail/senha, convites, recuperação)   |
| E-mail    | Resend                                              |
| Observab. | Sentry + PostHog                                    |
| Testes    | Vitest (unit) + Playwright (e2e)                    |
| Deploy    | Vercel (funções em gru1 — São Paulo)                |

## Como rodar

Requisitos: **Node 22+** e npm.

```bash
npm install
copy .env.example .env   # Windows (cp no macOS/Linux) — preencha os valores
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

> O `.env` precisa de `DATABASE_URL`/`DIRECT_URL` (Supabase), `BETTER_AUTH_SECRET` (32+ chars) e `BETTER_AUTH_URL`. `RESEND_API_KEY` é opcional em dev — sem ela, os e-mails aparecem no console.

## Scripts

| Script               | O que faz                                       |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Servidor de desenvolvimento (Turbopack)         |
| `npm run build`      | Build de produção                               |
| `npm run lint`       | ESLint                                          |
| `npm run typecheck`  | TypeScript (sem emitir)                         |
| `npm run format`     | Prettier em todo o projeto                      |
| `npm test`           | Testes (Vitest): unit + integração (banco real) |
| `npm run e2e`        | Testes ponta a ponta (Playwright)               |
| `npm run db:migrate` | Cria e aplica migrations (create-only + deploy) |
| `npm run db:deploy`  | Aplica migrations pendentes (produção)          |
| `npm run db:seed`    | Popula dados de desenvolvimento (idempotente)   |
| `npm run db:studio`  | Prisma Studio                                   |

> Para rodar e2e na primeira vez: `npx playwright install chromium`. Os testes de integração batem no banco do `.env` (criam e limpam os próprios dados).

## Banco de dados (Prisma 7 + Supabase)

```bash
npm run db:migrate   # cria a migration a partir do schema e aplica no banco
npm run db:seed      # funil padrão + conta demo + 12 leads de exemplo
npm run db:studio    # Prisma Studio
```

> **Por que `db:migrate` usa `--create-only` + `deploy`?** O pooler do Supabase não suporta o _shadow database_ que o `migrate dev` usa para detectar drift (o engine cria o banco temporário e não consegue conectar → erro P1001). O fluxo create-only + deploy não usa shadow e é determinístico.
>
> Quer o `migrate dev` completo (com detecção de drift)? Crie um **segundo projeto Supabase free** só como shadow e defina `SHADOW_DATABASE_URL` no `.env`.

## Autenticação e contas

- **Cadastro** (`/cadastro`): cria a conta (empresa) + o primeiro usuário **Admin** — é o caminho oficial de entrada.
- **Login** (`/login`) · **Recuperação** (`/esqueci-senha` → `/redefinir-senha`) · **Convites**: o Admin gera o link em `/equipe` e o convidado entra por `/convite/[token]`.
- **Logins da demo** (depois de `npm run db:seed`): `ana@demo.tervian.dev` (Admin) e `bruno@demo.tervian.dev` (Vendedor) — senha `demo1234` (só demonstração local).
- **Desativar** um usuário em `/equipe` derruba as sessões na hora, bloqueia login novo e não apaga histórico.
- O `proxy.ts` faz só uma checagem **otimista** do cookie de sessão (menos latência); a validação real acontece em toda página/action via `requireAuth()`/`requireRole()` (`lib/session.ts`).
- Fluxos com rate limit (login, cadastro, reset) passam pelo navegador em `/api/auth/*`; cadastro e convite são Server Actions (criam a conta no servidor).

## Contatos e captura de leads

- **`/contatos`**: lista com busca por nome/telefone, paginação e recorte por papel (vendedor vê só os próprios).
- **`/contatos/novo`**: captura rápida em **nome + telefone**; cria automaticamente o negócio na etapa “Novo” e a tarefa “Primeiro contato” para hoje.
- **`/contatos/[id]`**: ficha com **Abrir no WhatsApp** / **Ligar**, edição, troca de responsável (Admin) e exclusão lógica.
- **Telefone duplicado** não duplica o lead: a tela avisa e oferece abrir o contato existente.
- O funil padrão (Novo → Contatado → Proposta enviada → Negociação) nasce com a conta; contas antigas ganham o funil no primeiro lead.
- Excluir um contato tira os negócios **abertos** do funil e cancela tarefas futuras; ganhos/perdidos e tarefas concluídas ficam no histórico.

## Estrutura

```
app/          rotas e telas — (auth) públicas e (app) logadas (App Router)
components/   UI compartilhada (shadcn/ui)
lib/          utilitários — env, phone, auth(+client), session, access, analytics, tenant-*, schemas/ (Zod)
server/       regras de negócio — signup, invites, team, services/ (leads, contatos, funil), erros tipados
prisma/       schema, migrations e seed
tests/        testes Vitest — unit/ e integration/ (banco real)
e2e/          testes ponta a ponta (Playwright)
.notes/       planejamento, decisões e backlog
```

## Fluxo de trabalho (branches e PRs)

Cada tarefa sai de uma branch criada a partir do `master` atualizado e entra por PR:

```bash
git switch master
git pull --ff-only
git switch -c 007-motor-followup
# ... implementa e testa ...
git push -u origin 007-motor-followup
```

- **Nome da branch:** `NNN-slug-curto` para tarefas (ex.: `007-motor-followup`) e `chore/slug` para manutenção.
- **PR para `master`:** o CI roda formatação, lint, typecheck, testes e build em todo PR. Use o template em `.github/pull_request_template.md`.
- **Checkpoint revisável:** descreva o que mudou, como testar e anexe evidências de UI. Merge só com CI verde; depois apague a branch.
- **Tarefas empilhadas:** se a próxima depender de uma branch ainda aberta, baseie-a nela e mergeie na ordem.
- **Sem push direto no `master`:** mesmo hotfix urgente passa por um PR curto.

## Convenções (valem para todo PR)

1. **Validação em um só lugar:** toda entrada (formulário, Server Action, CSV, formulário público) é validada com os schemas de `lib/schemas/` no servidor.
2. **Isolamento por conta:** todo código de feature usa `tenantDb()` — o client estendido que injeta `account_id` automaticamente (ver `lib/tenant-prisma.ts` e `.notes/004-isolamento-multi-tenant.md`). `prismaBase` é só para operações de sistema (onboarding, auth, scripts). SQL cru (`$queryRaw*`) é bloqueado no lint.
3. **Sessão e papel:** página/action protegida usa `requireAuth()`/`requireRole()` e roda as queries de domínio dentro de `withSession`/`withAdmin` (abre o contexto de tenant). Papel nunca vem do client.
4. **Server Components por padrão;** `"use client"` só onde houver interação.
5. **Nunca leia `process.env` direto** — use `lib/env.ts`.
6. **Esta versão do Next.js tem mudanças:** antes de codar algo do framework, consulte o guia local em `node_modules/next/dist/docs/` (o `AGENTS.md` da raiz explica).

## Planejamento do MVP

- Quadro de tarefas: [.notes/todo.md](./.notes/todo.md)
- Decisões técnicas fechadas: [.notes/000-decisoes-tecnicas.md](./.notes/000-decisoes-tecnicas.md)
- Critérios de lançamento: [.notes/016-lancamento-piloto.md](./.notes/016-lancamento-piloto.md)
