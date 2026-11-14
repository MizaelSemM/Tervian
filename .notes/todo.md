# ✅ TODO — CRM de Follow-up para Pequenas Equipes de Vendas (MVP)

**Fonte:** [PRD – CRM de Follow-up para Pequenas Equipes de Vendas (MVP)](<../PRD – CRM de Follow-up para Pequenas Equipes de Vendas (MVP).md>)
**Atualizado em:** 14/11/2026 · **Fase atual:** 3 — Qualidade e lançamento · **Prazo recalibrado: ~6–8 semanas** (ritmo ~20–25h/semana)

---

## 🧭 Norte do MVP (leia antes de qualquer tarefa)

- **Tese:** o vendedor ganha valor no primeiro dia — ele abre o app e sabe **quem chamar e por quê**.
- **Métrica norte:** negócios com **próxima ação agendada e executada no prazo**.
- **Escopo congelado:** só P0 entra no MVP. Item novo só entra trocando por outro item (risco nº 5 do PRD).
- **Prioridade:** P0 = obrigatório para lançar · P1 = MVP+ (`015`) · P2 = fase posterior.

### ✅ Decisões fechadas em 17/10/2026 (ver `000`)

Better Auth (scrypt) · Supabase Postgres **São Paulo** + Vercel **gru1** · multi-tenant desde o dia 1 · lead do formulário → responsável padrão configurável · segmento genérico até as entrevistas · jobs via Vercel Cron.

---

## ⏳ Em Progresso

- [ ] **013 · Segurança, LGPD e observabilidade** → [013-seguranca-lgpd-observabilidade.md](013-seguranca-lgpd-observabilidade.md) — código implementado; faltam migrations, credenciais de Sentry/PostHog, restore de backup e monitor de uptime (dependem do painel do dono)
- [ ] **014 · Testes e QA** → [014-testes-qa.md](014-testes-qa.md) — suíte E2E e job do CI implementados; 18 testes validados localmente, aguardando execução verde no CI
- [ ] **012 · PWA, mobile-first e UX de um clique** → [012-pwa-ux-mobile.md](012-pwa-ux-mobile.md) — base implementada; faltam medições (4G/Lighthouse) e teste em aparelho real

> ⚠️ **Revisão de 13/11/2026:** o quadro marcava 008–011 como concluídas, mas 009 e 010 ainda tinham critérios de aceite abertos. 009 e 010 foram fechadas; 008 e 011 já estavam implementadas.
> Migration nova da 010 (`add_public_form_settings`) precisa ser aplicada no Supabase com `npm run db:migrate`.
> Migrations no Supabase: usar `npm run db:migrate` (create-only + deploy) — o pooler não suporta o shadow database do `migrate dev` (ver 002).

## ⏸️ Aguardando terceiros (não bloqueia código)

- [ ] **001 · Fundação: repositório, stack e infra mínima** → [001-fundacao-setup.md](001-fundacao-setup.md)
  - [x] Scaffold Next.js 16 + TypeScript + Tailwind + ESLint
  - [x] Git + README do projeto + marca (pt-BR)
  - [x] Prettier + ESLint integrados (scripts `format`/`format:check`)
  - [x] Validação de env com Zod (`lib/env.ts`) + `.env.example` + `.gitignore` ajustado
  - [x] Configs de teste criadas (`vitest.config.ts` + `playwright.config.ts`)
  - [x] Dependências instaladas (npm muito lento nesta máquina — ~40min no total)
  - [x] **Prisma 7.10.1** (CLI+client, exato) + `@prisma/adapter-pg` + `pg` + singleton em `lib/prisma.ts`
  - [x] `prisma init` + `prisma generate` validados (client gerado em `lib/generated/prisma`)
  - [x] shadcn/ui inicializado + 8 componentes base (button, input, label, card, skeleton, sonner, badge, separator)
  - [x] Build de produção, lint e typecheck passando
  - [x] CI (GitHub Actions) com Postgres efêmero, migrations, lint, typecheck, testes e build
  - [ ] Vercel + Sentry + PostHog → **precisam das contas do dono**
  - [ ] Resend → conta + domínio verificado para e-mails reais de convite/reset (em dev o link cai no console)
  - [ ] Supabase: recriar o projeto em **São Paulo** antes do piloto (hoje está em us-east-1; sem dados reais, é só trocar as strings do `.env` — ver `000`)

---

## 📋 Backlog (Próximas Tarefas)

### Bloco 3 — CRM essencial *(semana 2–3)*

- [x] **005 · Contatos e captura rápida de lead** (RF-10, RF-13, RF-14) → [005-contatos-e-captura.md](005-contatos-e-captura.md)
- [x] **006 · Funil e negócios: kanban + lista** (RF-20..RF-23) → [006-funil-kanban-negocios.md](006-funil-kanban-negocios.md)

### Bloco 4 — Diferencial do produto ⭐ *(semana 3–5)*

- [x] **007 · Motor de follow-up + tela "Hoje"** (RF-30..RF-32, US-01, US-02) → [007-motor-followup-tela-hoje.md](007-motor-followup-tela-hoje.md)

### Bloco 5 — Contexto e entradas *(semana 5)*

- [x] **008 · Histórico, notas e busca global** (RF-40..RF-42) → [008-historico-notas-busca.md](008-historico-notas-busca.md)
- [x] **009 · Importação de CSV** (RF-11, US-06) → [009-importacao-csv.md](009-importacao-csv.md) — lotes de 100 linhas com progresso, decisão de duplicado e fixture de 5.000 linhas
- [x] **010 · Formulário público de captura** (RF-12) → [010-formulario-publico.md](010-formulario-publico.md) — slug/ativação/título/mensagem/responsável, embed + QR e prévia ao vivo

### Bloco 6 — Gestor *(semana 5–6)*

- [x] **011 · Painel do gestor** (RF-50..RF-52, US-04, US-05) → [011-painel-gestor.md](011-painel-gestor.md)

### Bloco 7 — Qualidade do MVP *(semana 6–7)*

- [ ] **012 · PWA, mobile-first e UX de um clique** → [012-pwa-ux-mobile.md](012-pwa-ux-mobile.md) — base implementada; faltam medições e teste em aparelho real
- [ ] **013 · Segurança, LGPD e observabilidade** → [013-seguranca-lgpd-observabilidade.md](013-seguranca-lgpd-observabilidade.md) — implementada; pendências externas no arquivo da tarefa
- [ ] **014 · Testes e QA** (Vitest + Playwright, isolamento, "Hoje" < 2s) → [014-testes-qa.md](014-testes-qa.md) — specs e CI implementados; 14 E2E verdes (4 skip mobile) na validação local

### Bloco 8 — Lançamento *(semana 7–8)*

- [ ] **016 · Lançamento e piloto** (critérios da seção 19, 3 empresas) → [016-lancamento-piloto.md](016-lancamento-piloto.md)

### Depois do MVP

- [ ] **015 · Backlog MVP+ (P1) e Fase 2** — cadências, alertas de parados, templates, exportação, Google login → [015-mvp-plus-p1.md](015-mvp-plus-p1.md)

---

## ✅ Concluído

- [x] 17/10/2026 — Análise do PRD e mapeamento P0 / P1 / P2
- [x] 17/10/2026 — Estrutura de gerenciamento de tarefas criada em `.notes/` (este arquivo + 17 arquivos de detalhe)
- [x] 17/10/2026 — **000 · Decisões técnicas bloqueantes fechadas** (Better Auth, Supabase SP, multi-tenant, atribuição de lead, segmento, jobs)
- [x] 17/10/2026 — Scaffold do app (Next.js 16 + TS + Tailwind + ESLint) + marca e README
- [x] 17/10/2026 — **Fundação de código completa**: Prisma 7.10.1 + adapter pg + singleton, shadcn/ui (8 componentes), env com Zod, Vitest/Playwright configurados, Prettier — build/lint/typecheck verdes (commit de checkpoint)
- [x] 17/10/2026 — **002 · Modelo de dados concluída**: schema com 12 tabelas + enums + índices, migration inicial aplicada no Supabase, seed idempotente (conta demo: 12 contatos/negócios + 13 tarefas), telefone E.164 com 13 testes verdes
- [x] 17/10/2026 — **004 · Isolamento multi-tenant concluída**: client de tenant (`$extends`) com `account_id` automático, contexto por request (AsyncLocalStorage), SQL cru bloqueado no lint, regressão estrutural do schema — 15 testes novos (28 verdes no total)
- [x] 17/10/2026 — **003 · Auth, contas, papéis e convites concluída**: Better Auth 1.7.10 (sessão em cookie, scrypt, rate limit), cadastro cria conta + Admin, convites com link copiável e uso único, reset de senha ponta a ponta, `/equipe` com desativar/reativar, proxy otimista + `requireAuth`/`requireRole` — 25 testes novos (53 verdes no total), build Cache Components ✓
- [x] 23/10/2026 — **005 · Contatos e captura rápida concluída**: `createLead()` transacional (contato + negócio “Novo” + tarefa “Primeiro contato” para hoje + timeline), funil padrão criado no cadastro e garantido para contas antigas, `/contatos` com busca/paginação, edição, exclusão lógica com limpeza de negócios abertos e WhatsApp/ligar em lista e detalhe — 21 testes novos (74 verdes no total), build/lint/typecheck ✓
- [x] 24/10/2026 — **006 · Funil e negócios concluída**: kanban com dnd-kit + Server Action otimista, lista mobile/paginada e alternador de visão, cards com valor/contato/responsável/previsão/dias sem atividade/próxima ação, mover etapa com timeline e próxima ação obrigatória, fechamento ganho (valor final) e perdido (motivo obrigatório), detalhe com timeline/tarefas/notas e “Adiar 1 dia” com desfazer, isolamento de vendedor na query — 31 testes novos (105 verdes no total), typecheck/lint/build e verificação manual em produção ✓
- [x] 30/10/2026 — **007 · Motor de follow-up + tela “Hoje” concluída**: raiz do app vira a fila do dia, fuso da conta (com horário de verão), atrasadas/hoje/concluídas, WhatsApp/ligar/concluir com alvos grandes, resultado + próxima ação em 2 toques, conclusão otimista, filtro por vendedor para admin, follow-up transacional e fechamento ganho/perdido preservando a tarefa concluída — 27 testes novos (132 verdes no total), “Hoje” com 200 tarefas em < 2s, typecheck/lint/build ✓
- [x] 07/11/2026 — **008 · Histórico, notas e busca global concluída**: timeline imutável com `logEvent()`, notas rápidas com edição/exclusão, busca global por nome/telefone com Ctrl/Cmd+K, resultados com negócios abertos e WhatsApp, atalho para criar lead — implementação no `master`; checkboxes do arquivo de detalhe serão fechados na revisão de aceite
- [x] 08/11/2026 — **011 · Painel do gestor concluída**: KPIs de funil, previsão ponderada, negócios parados, sem próxima ação, atividade por vendedor, filtros de período/parados e reatribuição em lote na carteira — implementação no `master`; checkboxes do arquivo fechados na revisão de aceite
- [x] 13/11/2026 — **010 · Formulário público concluída**: slug configurável (`/f/<slug>` com fallback para o id), ativar/desativar, título/mensagem de agradecimento, responsável padrão, WhatsApp pós-envio, snippet de embed, QR local e prévia ao vivo em `/configuracoes`; lead cai na tela “Hoje” via `createLead()` — 10 testes unitários novos (90 verdes)
- [x] 13/11/2026 — **009 · Importação de CSV concluída**: lotes de 100 linhas via Server Action com barra de progresso e cancelamento, mapeamento automático de colunas, Latin-1/Windows-1252, separador `;`/`,`/tab, decisão de duplicado (ignorar/atualizar/criar negócio), opção “só contatos”, relatório com CSV de erros e fixture de 5.000 linhas no CI — 6 testes novos (80 unitários verdes)
- [x] 13/11/2026 — **012 · PWA/mobile/UX — base implementada**: navegação inferior (Hoje/Funil/Contatos/Painel) com alvos de 56px, manifest + service worker (network-first e fallback `/offline`) + aviso de atualização, desfazer em concluir tarefa/adiar/mudar etapa, atalhos de data no negócio e skeletons nas listas/detalhes — faltam Lighthouse, medição em 4G e teste em aparelho real
- [x] 14/11/2026 — **013 · Segurança, LGPD e observabilidade — código implementado**: headers/CSP + noindex no proxy, termos e política em `/termos` e `/privacidade` com aceite versionado no cadastro, exportação JSON e exclusão definitiva por contato, documento de operação LGPD, Sentry/PostHog sem SDK e com PII higienizada, eventos do PRD padronizados, dashboard das 6 métricas em `/painel/metricas`, Dependabot + `npm audit` no CI — 97 testes unitários verdes; faltam credenciais, migrations, restore de backup e monitor de uptime

---

## 📌 Regras deste quadro

1. Uma tarefa em "Em Progresso" por vez (ou o mínimo possível) — o foco é o diferencial do produto.
2. Tarefa só vai para "Concluído" quando o critério de aceite do arquivo de detalhe for atendido.
3. P1 nunca entra no MVP sem trocar por um item P0.
4. Toda decisão técnica relevante é registrada no `000`.
