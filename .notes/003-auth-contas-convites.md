# 003 · Autenticação, contas, papéis e convites

**Requisitos:** RF-01, RF-02, RF-03, RF-04 (P0) · RF-05 (P2)
**Prioridade:** P0 · **Depende de:** 002, 004 (base) · **Bloqueia:** 005–011
**Status:** ✅ **Concluída em 17/10/2026** — registro completo no fim do arquivo

---

## Autenticação (RF-01)

- [x] **Better Auth 1.7.10** (decisão do `000`) + `@better-auth/prisma-adapter` — sessão em cookie httpOnly (plugin `nextCookies`)
- [x] Hash de senha com **scrypt** (padrão do Better Auth — a spec citava argon2; a decisão do `000` prevaleceu). Credenciais nunca são logadas
- [x] Login por e-mail e senha com mensagens de erro neutras ("E-mail ou senha inválidos")
- [x] Recuperação de senha por e-mail (**Resend**) com token de uso único e expiração curta (1h)
- [x] Rate limit em login/cadastro/recuperação (Better Auth: 3 req/10s por rota, pelo navegador; `auth.api.*` server-side é isento e usado só pelos nossos fluxos)

## Contas e papéis (RF-02, RF-03)

- [x] Cadastro cria a conta + primeiro usuário **Admin** numa tela (Server Action `signUpCompany`); o endpoint público de cadastro do Better Auth é **bloqueado** — todo usuário nasce de cadastro ou convite
- [x] Sessão carrega `user_id`, `account_id` e `role` (additionalFields com `input: false` — nunca aceitos do client; injetados por contexto de cadastro no servidor)
- [x] Helpers `requireAuth()` / `requireRole("ADMIN")` (`lib/session.ts`); `proxy.ts` faz só checagem otimista de cookie; **nenhuma** página/action passa sem validação real
- [x] Recorte por papel pronto: `ownerScope()` (`lib/access.ts`) — Vendedor vê só os próprios negócios, Admin vê tudo (aplicação nas queries a partir da 005/006, onde a UI nasce)
- [x] Desativar usuário (`active = false`) sem apagar histórico: derruba as sessões na hora, bloqueia login novo (hook `session.create.before`) e `requireAuth` barra quem já está logado

## Convites (RF-04)

- [x] Convite por e-mail (Resend; console em dev) **e** por link copiável — token aleatório de 32 chars, validade de 7 dias, revogável, uso único (claim atômico)
- [x] Tela "aceitar convite" (`/convite/[token]`): cria o usuário vinculado ao `account_id` **do convite** (nunca ao digitado pelo usuário)
- [x] Admin lista convites pendentes e usuários da conta em `/equipe`, com desativar/reativar

## Fora do escopo agora

- [ ] (P2) Login com Google → registrar no `015` quando o MVP validar

---

**✅ Critérios de aceite:** convidado cria conta e entra na conta certa; vendedor não acessa negócio de outro vendedor nem por URL direta; recuperação de senha funcional ponta a ponta; par de testes com o `004`.

---

## 📝 Registro de implementação (17/10/2026 — concluída)

**Arquitetura**

- `lib/auth.ts`: config do Better Auth — hook `user.create.before` injeta `accountId` + `role` a partir do **contexto de cadastro** (`lib/auth-signup-context.ts`, AsyncLocalStorage, aberto só por `server/signup.ts` e `server/invites.ts`); hook `session.create.before` bloqueia usuário inativo; `revokeSessionsOnPasswordReset`; reset com 1h; rate limit explícito.
- Modelo `account` do Better Auth mapeado para a tabela **`auth_accounts`** (`modelName: "authAccount"`) — ali `account_id` é o id do **provedor**, não a conta/tenant (essa é `User.account_id`); comentado no schema para não confundir.
- `lib/tenant-prisma.ts` (atualizado): `TENANT_MODELS` passou a listar **só models com `account_id` de tenant** (saiu `account`, entrou `invite`); novo `GLOBAL_MODELS` (Account, Session, AuthAccount, Verification). Usar model global no client de tenant **lança erro**, e model novo fora das duas listas **também lança** (fail-closed — nada escapa por esquecimento).
- `proxy.ts`: redireciona para `/login?redirect=…` **só quando não há cookie de sessão** (barreira otimista); a validação real (sessão no banco + `active` + papel) é sempre no servidor. `/login` não auto-redireciona logado (evita loop com cookie velho).
- Área logada `(app)` com `export const instant = false` (opt-out do Cache Components — decisão de MVP; streaming fica para a 016). Páginas públicas estáticas com formulários client sob `<Suspense>` — build: `/login`, `/cadastro` etc. **○** estáticas; `/convite/[token]` **◐** (shell estático + parte dinâmica em streaming).
- Convites: token `randomBytes(24).base64url` (32 chars), 7 dias, **texto plano** no banco (credencial de curto prazo; hash fica para o hardening da 013), aceite com `updateMany` condicional (uso único mesmo com cliques duplos) + rollback do claim se o cadastro falhar.
- Serviços: `server/signup.ts`, `server/invites.ts`, `server/team.ts`, com `server/errors.ts` (AppError) e `server/auth-errors.ts`. Validação Zod pt-BR em `lib/schemas/auth.ts` (normaliza e-mail antes de validar); `lib/safe-redirect.ts` fecha open redirect no `?redirect=`.
- Divisão de fluxos: login e reset pelo **navegador** (`authClient` → `/api/auth/*`, passam pelo rate limit); cadastro e aceite de convite por **Server Actions** (precisam criar/claimar a conta e abrir o contexto de cadastro).

**Testes — 53 verdes no total (30 unit + 23 integração)**

- Unit novos (11): schemas de auth (5), `sanitizeRedirectPath` + `ownerScope` (5) e +1 no teste estrutural (partição `TENANT_MODELS` ∪ `GLOBAL_MODELS`, sem sobreposição).
- Integração nova (`tests/integration/auth-flow.test.ts`, 14 — contra o banco real): cadastro + credencial com hash, e-mail duplicado sem conta órfã, endpoint público bloqueado, login certo/errado, reset completo (token via banco → senha nova → sessões revogadas → token consumido), convites (criar/aceitar/reutilizar/revogar/expirar), desativar/reativar (derruba sessões + bloqueia login), guards (auto-desativação, último admin), client de tenant recusando models de auth e carimbando `invite`.

**Seed + DX**

- `npm run db:seed` cria os logins demo: `ana@demo.tervian.dev` (Admin) e `bruno@demo.tervian.dev` (Vendedor), senha `demo1234` (credenciais Better Auth com hash scrypt — só demonstração local, documentado no README).
- Sem `RESEND_API_KEY`, `lib/email.ts` registra o e-mail (com link) no console — dá para testar reset/convite sem provedor.

**Verificações**

- `npm run build` ✓ (Cache Components validado) · typecheck ✓ · lint ✓ · format ✓ · `npm test` 53 ✓.
- `next build` regenera os tipos de rota; `PageProps<"/convite/[token]">` usado com `params` assíncrono (Next 16).

**Pendências conhecidas**

- E-mail real: criar conta Resend + `RESEND_API_KEY` + domínio verificado (item de contas do dono, pendência da 001).
- Reavaliar streaming na área logada (remover `instant = false`) na tarefa de performance (016).
- A senha demo `demo1234` é fraca de propósito (local) — o cadastro real exige 8+ e é o caminho oficial.
- **Login (corrigido na 005):** após `signIn.email`, a navegação passou a ser hard (`window.location.assign`) — o router client-side podia reutilizar o RSC de `/` pré-carregado sem sessão e voltar para `/login`.
