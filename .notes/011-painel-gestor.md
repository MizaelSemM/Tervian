# 011 · Painel do gestor

**Requisitos:** RF-50, RF-51, RF-52 (P0) · RF-53, RF-54 (P1 → `015`) · US-04, US-05
**Prioridade:** P0 · **Depende de:** 002, 006, 007, 008 (dados denormalizados) · **Bloqueia:** `016`

> **Princípio 5 do produto: "o gestor vê sem pedir".** Nenhum dado aqui pode depender de relatório preenchido à mão.

---

## Indicadores P0

- [ ] Agregações feitas **no servidor** (Recharts recebe só o resumo, nunca a lista crua de negócios)
- [ ] **Valor e quantidade por etapa** (barras por etapa do funil) (RF-50)
- [ ] **Previsão de receita do mês** = Σ(valor × probabilidade da etapa) — mostrar a fórmula na tela para gerar confiança
- [ ] **Negócios parados** (RF-51): sem atividade há X dias (X configurável, padrão 7) — lista clicável com dias parados
- [ ] **Leads/negócios sem próxima ação** (RF-51): deveria ser zero; exibir como alerta operacional e não só como lista
- [ ] **Atividade por vendedor** (RF-52): tarefas concluídas vs. atrasadas na semana; clicar no vendedor abre a lista de tarefas atrasadas dele (US-04)
- [ ] Filtro de período simples (mês atual / últimos 30 dias)
- [ ] Visão "como está o mês": total no funil, previsão, parados e tarefas atrasadas no topo (30 segundos de leitura)

## Gestão de carteira (US-05)

- [ ] **Reatribuição em lote** de negócios entre vendedores (selecionar vários → trocar responsável)
- [ ] Histórico preservado: eventos antigos mantêm o autor original; a troca gera evento "responsável alterado"
- [ ] Reatribuição disponível também no detalhe do negócio (individual)

## Performance e acesso

- [ ] Carrega em **< 2s** com centenas de negócios: queries agregadas + índices do `002` + cache curto (ex.: 60s)
- [ ] Somente **Admin** acessa o painel; vendedor que tentar por URL é redirecionado
- [ ] Estado vazio com orientação ("cadastre seus vendedores e negócios para ver o funil")

## P1 (ver `015`)

- [ ] RF-53 funil de conversão e top motivos de perda · RF-54 exportação CSV dos dados da conta

---

**✅ Critérios de aceite (US-04):** gestor responde em 30s a "quanto tem no funil, o que está parado e quem não está fazendo follow-up"; clicar em um vendedor mostra as tarefas atrasadas dele; reatribuir em lote funciona sem perder histórico.

---

## Implementação (08/11/2026)

- **Página `/painel`** (Admin): KPIs de funil, previsão, parados, sem próxima ação e tarefas atrasadas; filtros de período (mês atual / últimos 30 dias) e de dias parados (7/14/30); resumo do período (novos, ganhos, concluídas).
- **Agregações no servidor** (`server/services/dashboard.ts`): `groupBy` por etapa, contagens e listas curtas; o client recebe apenas o resumo por etapa.
- **Regras puras** em `lib/dashboard.ts` (período no fuso da conta, corte de parados, previsão ponderada e resumo por etapa), cobertas por `tests/unit/dashboard.test.ts`.
- **Recharts** (`app/(app)/painel/dashboard-charts.tsx`): barras horizontais de valor e quantidade por etapa, com a fórmula da previsão exibida na tela.
- **Atividade por vendedor**: concluídas nos últimos 7 dias, atrasadas agora e tarefas abertas; clique no nome lista as atrasadas e leva à tela “Hoje” filtrada.
- **Carteira `/painel/carteira`** (US-05): filtro por responsável, paginação de 25 e reatribuição em lote (até 200 negócios). Tarefas abertas acompanham o novo responsável; cada negócio recebe `deal.owner_changed` e a reatribuição não atualiza `lastActivityAt`.
- **Detalhe do negócio**: a troca individual de responsável também gera `deal.owner_changed`, separado de `deal.updated`.
- **Acesso**: link “Painel” só para Admin; `withAdmin` na página e nas actions, com checagem repetida no serviço.
- **Testes**: 74 testes unitários verdes; `typecheck`, `lint` e `build` passando. Integração/seed continuam bloqueados pela indisponibilidade do Supabase no ambiente local.

> “Semana” da atividade foi implementada como **últimos 7 dias de calendário** no fuso da conta (mesma janela usada pelo restante do painel).
