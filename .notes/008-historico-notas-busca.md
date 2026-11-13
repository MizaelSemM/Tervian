# 008 · Histórico, notas e busca global

**Status:** ✅ Concluída em 07/11/2026 — implementação inicial em `008-historico-notas-busca`.

**Requisitos:** RF-40, RF-41, RF-42 (P0) · RF-43 (P1 → `015`)
**Prioridade:** P0 · **Depende de:** 002, 005, 006 (eventos nascem nesses módulos) · **Bloqueia:** 011 (painel usa `last_activity_at`)

---

## Timeline (RF-40)

- [x] Tabela `timeline_events` **imutável** (só insert — nunca update/delete)
- [x] Serviço único `logEvent()` e política: quais ações geram evento (criar/mover negócio, criar/concluir tarefa, nota, mudança de responsável, ganho/perdido, importação, convite aceito)
- [x] Testes garantindo que cada ação-chave gera exatamente **um** evento (sem duplicar, sem faltar)
- [x] Linha do tempo na tela do negócio **e** do contato: agrupada por dia, ícone por tipo, autor e horário no fuso da conta
- [x] Timeline preservada ao reatribuir carteira (US-05 — quem fez o quê continua registrado)

## Notas rápidas (RF-41)

- [x] Campo de nota no topo da timeline: digita (ou dita pelo teclado do celular) → Enter → salva e aparece
- [x] Sem categorias obrigatórias; nota pertence ao negócio e/ou contato
- [x] Editar/excluir nota registra evento de alteração (não apaga o fato original)

## Busca global (RF-42)

- [x] Atalho **Ctrl/Cmd + K** abrindo o command palette (implementado como modal de busca)
- [x] Busca por **nome ou telefone** (funciona com telefone parcial, ex.: "11 98")
- [x] Resultado mostra: contato, negócios abertos vinculados, próxima ação e botão WhatsApp direto
- [x] Debounce + cache curto; busca escopada por conta (via `004`) e por papel do usuário
- [x] Atalho para criar lead a partir da busca quando não houver resultado ("Criar '{termo}'")

## P1 (ver `015`)

- [ ] RF-43 tags e filtros por origem, etapa e responsável

---

**✅ Critérios de aceite:** toda ação relevante aparece na timeline sem buraco entre telas; busca encontra qualquer contato em 1 segundo; notas com ditado por voz funcionam sem código extra no iOS/Android.
