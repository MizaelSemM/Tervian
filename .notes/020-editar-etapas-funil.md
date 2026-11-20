# 020 · Editar etapas do funil (RF-24)

**Requisito:** RF-24 (admin edita nome, ordem e probabilidade das etapas)
**Prioridade:** P1 · **Depende de:** 005/006 (funil e kanban), 011 (previsão) · **Migration:** nenhuma
**Status:** implementado em 20/11/2026 na branch `020-editar-etapas-funil`; checks completos verdes.

---

## O que entrou

### Serviço e validação

- `server/services/pipeline.ts`: `updatePipelineStages()` recebe as etapas **na ordem final**, valida
  nomes/probabilidades e reatribui `position = 1..N` em uma transação.
- Antes de escrever, confere se o conjunto de IDs enviado é exatamente o funil atual da conta:
  formulário velho, etapa faltando ou ID de outra conta recebem
  `PIPELINE_STAGES_CHANGED` (sem salvar nada parcial).
- Nomes precisam ser únicos sem diferenciar caixa; repetição gera `PIPELINE_STAGE_NAME_TAKEN`.
  Nome de 2–60 caracteres e probabilidade inteira de 0–100 geram `PIPELINE_STAGE_INVALID` quando
  fora da faixa.
- `lib/pipeline.ts`: limites compartilhados entre schema e formulário.
- `lib/schemas/pipeline.ts`: Zod em pt-BR, incluindo IDs/nomes duplicados e probabilidade vazia,
  fracionada ou fora da faixa.

### Entrada de novos leads

- `ensureDefaultPipeline()` passou a devolver **a primeira etapa da ordem** como `newStage`, em vez
  de procurar uma etapa chamada “Novo”. Assim renomear ou reordenar o funil não quebra a captura:
  novos leads (manual, formulário público e CSV) entram sempre na primeira etapa.
- Textos que diziam “etapa Novo” passaram a dizer “primeira etapa do funil” em contatos, negócios e
  importação.

### Configurações (ADMIN)

- Novo card **“Etapas do funil”** em `/configuracoes`, acima dos modelos de mensagem.
- Cada etapa tem nome, probabilidade (%) e botões de subir/descer; a ordem do formulário é a ordem
  salva. Setas em vez de drag-and-drop: funcionam no celular e no teclado, sem dependência nova.
- `pipeline-actions.ts`: Server Action protegida por `withAdmin`, revalidando Configurações, funil,
  contato/negócio (detalhe e novo), painel e Hoje.
- A ação devolve as etapas normalizadas para o formulário refletir exatamente o que foi salvo.
- O card explica que a primeira etapa recebe novos leads e que a probabilidade alimenta a previsão
  ponderada do painel.

### Testes

- `tests/unit/pipeline.test.ts`: normalização, ordem, nomes/IDs duplicados, faixa de probabilidade e
  limites de nome.
- `tests/integration/pipeline.test.ts`: persistência de nome/probabilidade/ordem, primeira etapa como
  entrada de `createLead`, board na nova ordem, formulário velho/etapa de outra conta, nome repetido,
  valores inválidos e isolamento entre contas.
- `e2e/pipeline-stages.spec.ts`: admin renomeia, muda a probabilidade e reordena; recarrega e confere
  a persistência; cria um lead e vê o negócio na nova primeira etapa (mobile + desktop).

---

## Decisões

- **Sem migration:** `Stage` já tinha `name`, `position`, `probability` e `cadenceDays`. A RF-24 é
  camada de edição; criar/excluir etapas fica fora do escopo (o schema e o kanban continuam
  assumindo todas as etapas existentes).
- **Primeira etapa é a entrada:** a ordem passou a ter significado funcional. Sem uma flag de “etapa
  inicial”, usar a posição 1 é previsível e sobrevive a renomeações.
- **Transação com posições 1..N:** não há unique em `(pipelineId, position)`, então a reordenação
  pode reatribuir as posições em sequência dentro da transação. A checagem de conjunto antes da
  escrita protege contra edição concorrente/aba velha.
- **Setas em vez de drag:** menos código, acessível e confortável no mobile; o número da etapa é
  recalculado a cada movimento.
- **Probabilidade inteira de 0 a 100:** é o mesmo dado consumido por `weightedForecast()` no painel;
  valores fracionados não agregam e complicam a leitura.
- **`cadenceDays` preservado:** a edição só toca nome, probabilidade e posição; a RF-33 encontra o
  campo intacto.

---

## Checks

- [x] `npm run format:check`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test` — 197 testes (unidade + integração, 25 arquivos)
- [x] `npm run build`
- [x] `npx playwright test e2e/pipeline-stages.spec.ts` — 2/2 (mobile + desktop)

---

## Fora do escopo / próximos P1

- Criar/excluir etapas e múltiplos funis (Fase 2/3).
- RF-33 cadências por etapa usando `cadenceDays` e `template_id`.
- RF-34 alerta de negócio parado, RF-43 tags/filtros, RF-35 resumo diário e RF-05 Google login.
- Cobertura mínima de `server/services/` e endpoint `/api/health` continuam como dívida da 016.
