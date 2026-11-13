# 001 · Fundação: repositório, stack e infra mínima

**Status:** ⏸️ Código concluído; restam itens operacionais que dependem das contas do dono (Vercel/Sentry/PostHog/Resend) e a recriação do Supabase em São Paulo. Não bloqueia o desenvolvimento local.
**Requisitos:** seções 13 (stack) e 11 (RNF) do PRD
**Prioridade:** P0 · **Depende de:** decisões do `000` · **Bloqueia:** todos os módulos

---

## Projeto e convenções

- [x] Inicializar repositório Git + `README.md` com instruções de setup e scripts
- [x] Criar app **Next.js (App Router) + TypeScript** com ESLint + Prettier
- [ ] Configurar **Tailwind CSS + shadcn/ui** — base pronta (8 componentes); `dialog`, `sheet`, `command`, `calendar` e `table` entram conforme a tela precisar (012/014)
- [x] Estrutura de pastas: `app/`, `components/`, `lib/`, `lib/schemas/`, `server/services/`, `prisma/`, `tests/unit/` — `e2e/` será criado na 014
- [x] Path alias `@/` configurado
- [x] Validação de variáveis de ambiente com Zod (`env.ts`) — falha rápido se faltar segredo; `env.example` versionado
- [x] Configurar **Vitest** (unit) e **Playwright** (e2e) — só o setup; a suíte vem no `014`

## Banco e ORM

- [x] Provisionar **Postgres gerenciado** — Supabase criado (⚠️ em us-east-1; recriar em São Paulo antes do piloto)
- [x] Inicializar **Prisma**; `DATABASE_URL` fora do versionamento (`.env.local` + secrets da Vercel)
- [x] Scripts npm: `dev`, `build`, `lint`, `typecheck`, `test`, `e2e`, `db:migrate`, `db:seed`, `db:studio`

## Deploy contínuo

- [ ] Projeto na **Vercel** ligado ao repositório
- [ ] **Preview por pull request** apontando para branch de banco de dev
- [ ] Migrations aplicadas no deploy (script de build ou job dedicado)
- [x] Fluxo de PR documentado (`README` + `AGENTS.md`) e template em `.github/pull_request_template.md`
- [ ] Ativar a proteção da branch `master` no GitHub (Settings → Branches: exigir PR e CI verde)

## Observabilidade desde o dia 1 (mínimo)

- [ ] Inicializar **Sentry** (client + server + edge) com contexto de rota
- [ ] Inicializar **PostHog** (instrumentação de eventos vem no `013`)

---

**✅ Definição de pronto:** `npm run dev` sobe o app; lint + typecheck passam; deploy de preview acessível por URL; Sentry capturando um erro de teste.
