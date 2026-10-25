# 001 · Fundação: repositório, stack e infra mínima

**Requisitos:** seções 13 (stack) e 11 (RNF) do PRD
**Prioridade:** P0 · **Depende de:** decisões do `000` · **Bloqueia:** todos os módulos

---

## Projeto e convenções

- [ ] Inicializar repositório Git + `README.md` com instruções de setup e scripts
- [ ] Criar app **Next.js (App Router) + TypeScript** com ESLint + Prettier
- [ ] Configurar **Tailwind CSS + shadcn/ui** (form, dialog, sheet, command, calendar, table)
- [ ] Estrutura de pastas: `app/`, `components/`, `lib/`, `lib/schemas/`, `server/services/`, `prisma/`, `tests/unit/`, `e2e/`
- [ ] Path alias `@/` configurado
- [ ] Validação de variáveis de ambiente com Zod (`env.ts`) — falha rápido se faltar segredo; `env.example` versionado
- [ ] Configurar **Vitest** (unit) e **Playwright** (e2e) — só o setup; a suíte vem no `014`

## Banco e ORM

- [ ] Provisionar **Postgres gerenciado** (Neon/Railway/RDS) — bancos separados para dev, preview e produção
- [ ] Inicializar **Prisma**; `DATABASE_URL` fora do versionamento (`.env.local` + secrets da Vercel)
- [ ] Scripts npm: `dev`, `build`, `lint`, `typecheck`, `test`, `e2e`, `db:migrate`, `db:seed`, `db:studio`

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
