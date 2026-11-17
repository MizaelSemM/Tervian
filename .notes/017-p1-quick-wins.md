# 017 · Quick wins do MVP+ (RF-25, RF-53, RF-54)

**Requisitos:** RF-25 (reabrir negócio), RF-53 (conversão e motivos de perda), RF-54 (exportação CSV)
**Prioridade:** P1 · **Depende de:** 006 (negócios), 011 (painel) · **Migration:** nenhuma
**Status:** implementado em 17/11/2026 na branch `017-p1-quick-wins`; checks completos verdes.

---

## O que entrou

### RF-25 — Reabrir negócio fechado

- `reopenDeal()` em `server/services/deals.ts`, transacional:
  - limpa `status`, `closedAt`, `lostReasonId` e `lostNote`;
  - exige uma nova próxima ação (`nextActionAt`) e recria/reaproveita a tarefa aberta;
  - registra `deal.reopened` na timeline com o estado anterior (status, data, motivo e
    observação da perda), preservando o histórico;
  - mantém o valor final de um negócio ganho;
  - respeita o recorte de vendedor (`ownerScope`) e emite `deal_reopened` no analytics.
- `reopenDealSchema` em `lib/schemas/deal.ts` (servidor e client compartilham a mensagem).
- `reopenDealAction` em `app/(app)/negocios/actions.ts`.
- `DealReopen` em `app/(app)/negocios/[id]/deal-reopen.tsx`: botão com formulário de data,
  escondido atrás de “Reabrir negócio”, com feedback `?reaberto=1` na página.
- Testes de integração: reabrir ganho (valor preservado, tarefa recriada, evento anterior),
  reabrir perdido (motivo limpo e preservado no evento), negócio já aberto e negócio alheio.

### RF-54 — Exportação CSV

- `lib/csv.ts`: gerador puro com separador `;`, BOM UTF-8, CRLF e escape de aspas/quebra de
  linha. Proteção contra CSV injection (`=`, `@`, `+`/`-` seguidos de texto) sem estragar
  telefone em E.164.
- `server/services/export.ts`: `exportContactsCsv()` e `exportDealsCsv()`, incluindo registros
  com exclusão lógica e a coluna “Excluído em”.
- `GET /api/export/csv?tipo=contatos|negocios`, somente ADMIN, sem cache e como anexo.
- Card “Exportar dados (CSV)” em `/configuracoes` com os dois downloads.
- Testes unitários do escape/BOM/CRLF em `tests/unit/csv.test.ts`.

### RF-53 — Conversão e motivos de perda

- `conversionRate()` em `lib/dashboard.ts`: ganhos ÷ (ganhos + perdidos), com uma casa
  decimal e `null` quando não houve fechamento.
- `getDashboard()` passou a agregar perdas e `groupBy(lostReasonId)` no período, com nome do
  motivo (ou “Motivo removido”/“Sem motivo”) e valor somado.
- `LostReasonsChart` em `app/(app)/painel/lost-reasons-chart.tsx`: ranking horizontal no
  Recharts, recebendo apenas o agregado.
- Card “Conversão e motivos de perda” em `/painel`, com taxa de ganho, ganhos/perdidos e
  ranking por motivo.
- Teste unitário de `conversionRate` em `tests/unit/dashboard.test.ts`.

### Correção fora do escopo funcional

- Restaurados os caracteres UTF-8 corrompidos (U+FFFD) em sete arquivos do painel/contatos,
  incluindo rótulos visíveis (“Negócios”, “Gráficos”, “Última atividade”, mensagens de erro).

---

## Decisões

- **Reabrir zera o motivo da perda**, mas guarda o motivo anterior no payload de
  `deal.reopened`; o motivo continua disponível para auditoria/histórico.
- **Reabrir não apaga eventos**: a timeline é append-only por desenho; o novo evento conta a
  história completa.
- **CSV é visão de negócio**, complementar ao JSON da LGPD (013): o JSON atende o titular e
  preserva o banco; o CSV é para Excel/Sheets e para trocar de ferramenta.
- **RF-53 mede taxa de ganho no período**, não conversão histórica etapa-a-etapa. O funil por
  etapa já existe no painel; a leitura de conversão mais simples (ganhos vs. perdas) atende ao
  P1 sem inventar dados que o schema atual não registra.

---

## Checks

- [x] `npm run format:check`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test` — 172 testes (unidade + integração)
- [x] `npm run build`

---

## Fora do escopo / próximos P1

- RF-36 templates de mensagem, RF-34 alerta de parados (exige migration), RF-24 edição de
  etapas, RF-43 tags/filtros, RF-33 cadências, RF-35 resumo diário, RF-05 Google login.
- Cobertura mínima de `server/services/` e endpoint `/api/health` continuam como dívida da 016.
