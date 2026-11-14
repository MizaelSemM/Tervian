# 014 · Testes e QA

**Requisitos:** seção 13 (Vitest + Playwright), seção 19 (critérios de lançamento)
**Prioridade:** P0 · **Depende de:** 001 (setup) · cobre 003–011 · **Bloqueia:** `016`
**Status:** suíte implementada e validada localmente em 14/11/2026 (18 testes: 14 passam, 4 são skip no celular).

---

## Unitário (Vitest)

Critérios cobertos pela suíte existente (unit + integração, rodam no CI com Postgres efêmero):

- [x] Regra de follow-up: negócio aberto **nunca** fica sem próxima ação (criar, mover etapa,
      editar, concluir) — `tests/integration/followup.test.ts`, `deals.test.ts` e
      `tests/unit/` dos schemas.
- [x] Conclusão de tarefa exige resultado/próxima ação — exceto ganho/perdido —
      `tests/integration/followup.test.ts`.
- [x] `createLead()`: cria contato + negócio "Novo" + tarefa para hoje; duplicado não duplica —
      `tests/integration/leads.test.ts`.
- [x] Normalização de telefone BR/E.164 (`+55`, zero à frente, 9º dígito, DDD inválido) —
      `tests/unit/phone.test.ts`.
- [x] Previsão do mês = Σ(valor × probabilidade) e agregações do painel —
      `tests/unit/dashboard.test.ts`.
- [x] Schemas Zod por entidade rejeitam entrada inválida no servidor —
      `tests/unit/*-schemas.test.ts` + `privacy.test.ts`.
- [x] **Isolamento entre contas** — `tests/integration/tenant-isolation.test.ts`, obrigatório no CI.

## E2E (Playwright)

Specs em `e2e/`; cada teste cria a própria conta (nunca usa dados de produção):

- [x] Fluxo "Hoje" completo: atrasadas primeiro → WhatsApp → concluir → resultado →
      próxima ação → próxima tarefa — `e2e/today.spec.ts` (WhatsApp é link externo; o fluxo
      interno de conclusão é o que o teste percorre).
- [x] Cadastro de lead em < 20s, incluindo aviso de duplicado (US-03) —
      `e2e/today.spec.ts` + timer real medido pelo app.
- [x] Kanban: arrastar entre etapas persiste após recarregar — `e2e/kanban.spec.ts`
      (viewport desktop; no celular o funil abre em lista).
- [x] Fechar como perdido sem motivo é bloqueado; com motivo funciona — `e2e/kanban.spec.ts`.
- [x] Importação CSV com fixture de 5.000 linhas e relatório conferido — `e2e/import.spec.ts`
      (gerada no próprio teste; roda só no projeto desktop por tempo).
- [x] Formulário público cria lead e ele aparece em "Hoje" do responsável —
      `e2e/public-form.spec.ts`.
- [x] Convite → cadastro → login com papel correto (vendedor não acessa painel admin) —
      `e2e/auth.spec.ts`.
- [x] **Performance:** "Hoje" < 2s com 200 tarefas e 4G simulado — `e2e/performance.spec.ts`;
      as tarefas são criadas por `e2e/seed-perf.ts` no CI (conta demo do seed).

## Correções encontradas rodando o E2E

- **Cadastro não perde mais os campos digitados após um erro de validação.** O React 19
  reseta inputs não controlados depois de uma Server Action; a action agora devolve
  `companyName`, `name` e `email` no estado e o formulário usa `defaultValue`. A senha
  continua sendo pedida de novo (não volta para o cliente).
- **Relatório da importação conta os negócios criados.** Cada lead novo cria um negócio na
  etapa "Novo", mas `dealsCreated` só era incrementado no modo "criar novo" de duplicados;
  o relatório mostrava "0 novos negócios". Corrigido em `importRowsChunk()` e coberto por
  teste de integração em `tests/integration/leads.test.ts`.
- **Seletores do Playwright menos frágeis.** `role=alert` também casa com o announcer de
  rotas do Next; os testes filtram pelo texto. O destino pós-cadastro/redirecionamento é
  `/hoje` (a raiz redireciona), não `/`.

---

## Qualidade contínua

- [x] CI em todo PR: `format`, `lint`, `audit`, `typecheck`, unit + integração e build no job
      `checks`; E2E em job separado (`e2e`) com Postgres efêmero, seed e Chromium.
- [x] Seed/fixtures estáveis para os testes E2E — cada spec cria a própria conta; a conta demo
      só é usada no teste de performance, com dados determinísticos.
- [x] E2E rodando em viewport de celular **e** desktop (projetos `mobile-chrome` e
      `desktop-chrome`; specs pesados rodam só no desktop).
- [ ] Cobertura mínima de ~80% em `server/services/`: metas ainda não medidas. O Vitest não
      está configurado com `--coverage` (falta `@vitest/coverage-v8`); avaliar junto com a 016.

---

## Como rodar

```bash
# com Postgres de teste e migrations aplicadas + seed
npm run db:seed
npx tsx e2e/seed-perf.ts
npm run build && npm run e2e        # E2E usa o build de produção (webServer)
npx playwright test --project=desktop-chrome   # um projeto só
```

Local sem `CI`, o Playwright sobe `npm run dev` automaticamente; com `CI`, sobe
`npm run start` (por isso o job faz `npm run build` antes).

**✅ Critério de aceite:** suíte verde no CI cobrindo cada critério de lançamento verificável da seção 19; nenhum bug de isolamento conhecido aberto.
