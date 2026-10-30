# 007 · Motor de follow-up + tela "Hoje" ⭐ (coração do produto)

**Requisitos:** RF-30, RF-31, RF-32 (P0) · user stories US-01, US-02 · **métrica norte do PRD**
**Prioridade:** P0 · **Depende de:** 002, 005, 006 · **Bloqueia:** 011 (painel usa os dados daqui)

> **Se este módulo não encantar o vendedor no dia 1, o produto falha.** Ele vem antes de importação, formulário e painel se o prazo apertar.

---

## Regras de negócio (P0)

- [x] Todo negócio aberto exige **próxima ação com data** — validação no servidor em toda escrita (criar, mover etapa, editar, concluir tarefa)
- [x] Serviço central `server/services/followup.ts`: `completeTask()`, `scheduleNextAction()`, `recomputeDealActivity()` — com testes unitários (o `014` cobre)
- [x] **Não é possível concluir tarefa sem definir a próxima ação**, exceto se o negócio for marcado Ganho/Perdido (US-02)
- [x] Atalhos de data na conclusão: **Amanhã · 3 dias · 1 semana** + data livre (calendário)
- [x] Ao concluir, registrar resultado rápido: **Respondeu · Não respondeu · Pediu para voltar em… · Fechou · Perdeu**
  - "Pediu para voltar em…" pede a data e já cria a próxima tarefa
  - "Fechou"/"Perdeu" levam ao fechamento do negócio (com motivo, se perdido)
- [x] Manter `next_action_at` e `last_activity_at` **denormalizados** em `deals` a cada mudança

## Tela "Hoje" (US-01)

- [x] Lista priorizada: **atrasadas primeiro** (destacadas em vermelho com dias de atraso), depois as do dia
- [x] Botões por linha: **WhatsApp** (`wa.me`), **Ligar** (`tel:`), **Concluir** — alvos de toque grandes
- [x] Fluxo de conclusão sem sair da lista: resultado + próxima ação em 2 toques, e a lista rola para a próxima tarefa
- [x] Contadores no topo: atrasadas · hoje · concluídas hoje
- [x] Filtros: só minhas tarefas (vendedor) / por vendedor (admin)
- [x] Estados vazios: "nada atrasado 🎉" e "tarefas do dia concluídas"
- [x] Carrega em **< 2s com até 200 tarefas** (RNF) — uma query com os índices do `002`; thumbs de contato não bloqueiam render
- [x] Otimista: marcar como concluída não espera o servidor (com rollback e toast de erro)

## Implementação (30/10/2026)

- **Rota:** `/` redireciona para `/hoje` (URL canônica); "Hoje" é o primeiro item da navegação.
- **Fuso:** `lib/timezone.ts` usa `Account.timezone` (padrão `America/Sao_Paulo`), com início/fim de dia e horário de verão corretos. Atalhos de próxima ação nascem às **09:00** da conta.
- **Admin:** vê todos os vendedores por padrão; o seletor `?vendedor=<id>` filtra. Vendedor sempre vê só as próprias tarefas (recorte no `where`).
- **Conclusão:** `completeTask()` roda em transação: marca resultado, cria/atualiza a próxima tarefa, atualiza `next_action_at` e recalcula `last_activity_at`; se ganho/perdido falhar (valor/motivo), a tarefa não fica concluída pela metade.
- **Fechamento:** `applyDealCloseInTransaction()` foi extraído do `closeDeal()` e preserva a tarefa que acabou de ser concluída (`keepTaskId`), cancelando apenas as outras tarefas abertas.
- **Tela:** uma query para atrasadas+hoje, contador de concluídas em paralelo, `useOptimistic` para remover a linha na hora e rollback/toast em erro.
- **Testes:** 15 unitários (fuso + schema) e 12 de integração (fila, papéis, follow-up, ganho/perdido, rollback, 200 tarefas < 2s). Suíte total: **132 verdes**.
- **Sem migration:** o schema do `002` já tinha `Account.timezone`, índices de `Task` e campos denormalizados.


## Cadências e lembretes (P1 → `015`)

- [ ] RF-33 cadência por etapa · RF-34 alerta de negócio parado · RF-35 resumo diário 8h · RF-36 templates

---

**✅ Critérios de aceite:** US-01 e US-02 completos; nenhum negócio aberto sem próxima ação em nenhum caminho de código; "Hoje" < 2s com 200 tarefas; rotina diária executável só com o polegar.
