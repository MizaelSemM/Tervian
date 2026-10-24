# 006 · Funil e negócios (kanban + lista)

**Requisitos:** RF-20, RF-21, RF-22, RF-23 (P0) · RF-24, RF-25 (P1 → `015`)
**Prioridade:** P0 · **Depende de:** 002, 003, 005 · **Bloqueia:** 007 (motor de follow-up), 011 (painel)

---

## Funil

- [x] Funil padrão vindo do seed: **Novo → Contatado → Proposta enviada → Negociação → Ganho/Perdido** (RF-20)
- [x] Etapas de ganho/perdido não aparecem como colunas do kanban (são estados de fechamento)
- [ ] (P1) Admin edita nome, ordem e probabilidade das etapas → `015`

## Kanban (RF-21)

- [x] Kanban com **dnd-kit**; cada drop = Server Action otimista com rollback em erro + toast
- [x] **Visão em lista no celular** (kanban em tela pequena é usado apenas para consulta) — alternador kanban/lista
- [x] Card do negócio: título, valor, contato, responsável, data prevista, **dias sem atividade** e próxima ação
- [x] Mover etapa: registra `timeline_event`, atualiza `last_activity_at` e exige/valida próxima ação (integra com `007`)
- [x] Colunas com contagem e soma de valor no cabeçalho
- [x] Performance: fluido com até **500 negócios abertos** por conta (paginação por etapa + skeletons)

## Negócio (RF-22, RF-23)

- [x] Criar/editar negócio: título, valor, contato, etapa, responsável, data prevista de fechamento
- [x] Vendedor só vê e move os próprios negócios; Admin vê tudo (query, não só UI)
- [x] Fechar como **Ganho**: confirma valor final
- [x] Fechar como **Perdido**: motivo **obrigatório** (lista de `lost_reasons`) + observação opcional
- [x] Fechamento leva a `DealStatus` WON/LOST e registra evento na timeline
- [ ] (P1) Reabrir negócio fechado → `015`

## Detalhe do negócio (base da tela do `008`)

- [x] Cabeçalho com contato, valor, etapa, responsável, botões WhatsApp/Ligar e próxima ação
- [x] Aba/seções: timeline, tarefas do negócio, notas
- [x] Ação "Adiar 1 dia" na próxima ação (um clique, com desfazer)

---

**✅ Critérios de aceite:** arrastar entre etapas persiste após recarregar; perdido não fecha sem motivo; vendedor não vê negócio alheio; kanban utilizável com 500 negócios abertos.

---

## Implementação

- **Funil:** seed e cadastro garantem o pipeline padrão (`ensureDefaultPipeline` / `createDefaultPipelineForAccount`). O kanban só consulta `DealStatus.OPEN`; ganho/perdido são fechamentos.
- **Kanban:** `@dnd-kit/core` com `useOptimistic` + Server Action. O drop move o card na hora; em erro, o estado otimista é descartado e um toast explica o motivo. Colunas trazem contagem e soma dos valores abertos.
- **Escala:** `BOARD_STAGE_LIMIT = 50` cards por etapa, com contagem/soma via `groupBy` e link "Ver todos" para a lista filtrada. Lista paginada em 20 itens. O padrão do servidor é kanban no desktop e lista no celular; `?view=kanban|lista` permite trocar em qualquer tela.
- **Regras:** negócio aberto exige próxima ação (data + tarefa). Mover etapa sem próxima ação é rejeitado com `DEAL_NEXT_ACTION_REQUIRED`. Fechar limpa a próxima ação, cancela tarefas abertas e registra `deal.closed`; perder exige um `LostReason` ativo e grava o motivo no negócio.
- **Edição:** título, valor, responsável e data prevista no formulário; etapa tem controle próprio (também registra timeline). O contato é definido na criação — trocar o contato de um negócio existente não faz parte deste P0.
- **Detalhe:** cabeçalho com contato/WhatsApp/Ligar, resumo (valor, etapa, responsável, previsão, próxima ação, dias sem atividade), timeline, tarefas e notas. "Adiar 1 dia" agenda para amanhã com desfazer.
- **Isolamento:** `ownerScope()` entra no `where` de todas as consultas/mutações; vendedor recebe `DEAL_NOT_FOUND` ao tentar abrir/mover negócio alheio. O detalhe de negócio alheio cai no 404 (sem vazar dados).
- **Testes:** 105 testes passando (`npx vitest run`), incluindo 16 de integração de negócios. `npm run typecheck`, `npm run lint` e `npm run build` passam. Verificação manual em produção: drag persiste após reload, seletor de etapa persiste, formulário de perda exige motivo e vendedor não vê negócios de outro responsável.
