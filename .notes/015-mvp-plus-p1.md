# 015 · Backlog MVP+ (P1) e Fases seguintes (P2+)

**Prioridade:** P1 = MVP+ (só depois do P0 validado no piloto) · P2+ = fases posteriores
**Depende de:** MVP lançado (`016`) · **Regra de ouro:** item daqui **nunca** entra no MVP sem trocar por um item P0.

---

## Follow-up e automação (P1 — RF-33 a RF-36)

- [ ] **RF-33 Cadências por etapa:** regra (`stage_id`, dias após entrada, tipo de tarefa, template) gera tarefa sozinha
- [ ] Tela de configuração de cadências em Configurações (visualizar o "trilho" de cada etapa)
- [ ] **Executor de jobs** (Vercel Cron ou pg-boss — decisão no `000`): idempotente, log de execução, sem tarefa duplicada
- [ ] **RF-34 Alerta de negócio parado** (X dias configurável): aparece na tela "Hoje" e no painel do gestor
- [ ] **RF-35 Resumo diário por e-mail às 8h** (Resend) com as tarefas do dia, respeitando o fuso da conta
- [x] **RF-36 Templates de mensagem** com variáveis (`{nome}`, `{empresa}`, `{vendedor}`), copiáveis ou embutidos no link do WhatsApp — tarefa `019`

## Funil e dados (P1)

- [ ] **RF-24** Admin edita nome, ordem e probabilidade das etapas
- [x] **RF-25** Reabrir negócio fechado (com evento na timeline) — tarefa `017`
- [ ] **RF-43** Tags e filtros por origem, etapa e responsável
- [x] **RF-53** Funil de conversão e principais motivos de perda (Recharts) — tarefa `017`
- [x] **RF-54** Exportação CSV dos dados da conta (a empresa é dona dos dados) — tarefa `017`

## Conta (P2 previsto no PRD)

- [ ] **RF-05** Login com Google

## Fase 2 (após validação do piloto)

- [ ] Integração **WhatsApp Business API** (histórico automático das conversas) — avaliar custo/aprovação
- [ ] Integração com calendário (Google Calendar)
- [ ] App instalável com **push real** (notificações de tarefas do dia)

## Fase 3 (futuro)

- [ ] Metas e comissões · múltiplos funis · relatórios avançados · automações condicionais

---

**Critério de entrada do MVP+:** ≥ 70% dos vendedores do piloto usando em dias úteis **e** ≥ 2 empresas dizendo que não voltariam para a planilha (seção 15).
