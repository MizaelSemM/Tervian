# 012 · PWA, mobile-first e UX de um clique

**Status:** 🚧 Base implementada (13/11/2026). Navegação inferior, PWA (manifest/SW/aviso de atualização), desfazer em conclusão/adiar/mudança de etapa, atalhos de data e skeletons. Faltam as medições e testes em aparelho real (dependem de ambiente com banco).
**Requisitos:** RNF de mobile/PWA, princípios de produto 2, 3 e 4 (seção 6)
**Prioridade:** P0 · **Depende de:** 005–011 (aplica sobre as telas prontas) · **Bloqueia:** `016`

> O vendedor está na rua ou no balcão. **A tela "Hoje" é o produto** — o resto é suporte.

---

## Estrutura mobile

- [x] Navegação **inferior** no celular: Hoje · Funil · Contatos · Painel (admin) — com ícones e área de toque ≥ 44px
- [ ] Auditoria de responsividade das 7 telas da seção 12 do PRD, foco em 360–430px de largura
  - Revisão estrutural feita (nav inferior, paddings, cards e botões de 44px); falta validar em aparelho/DevTools.
- [x] Nada essencial atrás de hover; nenhum fluxo exige zoom
- [x] Botões primários ao alcance do polegar (parte inferior da tela)
- [x] Sheet/dialog nativos (shadcn) no mobile em vez de modais desktop
  - Não há modais no fluxo atual; telas são páginas completas (o padrão mobile-first já é o caminho principal).

## PWA

- [x] `manifest.json` com nome, ícones (192/512), tema e `display: standalone`
  - `app/manifest.ts` + ícones em `public/icons` (inclui maskable e apple-touch-icon).
- [x] Service worker com cache do app shell (dados sempre frescos — nunca mostrar tarefa velha do cache)
  - `public/sw.js`: navegação network-first + fallback `/offline`; só assets estáticos vão para o cache.
- [ ] Splash screen e ícone ao instalar; testar "Adicionar à tela inicial" em Android e iPhone
  - Pendente de teste manual em aparelho real.
- [x] Aviso de atualização disponível (evitar app preso em versão antiga)
  - Toast “Nova versão disponível” com ação “Atualizar” (`SKIP_WAITING` + reload).

## Ações de um clique (princípio 4)

- [x] WhatsApp (`wa.me`), Ligar (`tel:`) e Concluir acessíveis de qualquer lista sem abrir o detalhe
- [x] Feedback **otimista** com desfazer (undo) em: concluir tarefa, adiar 1 dia, mudar etapa
- [x] Toasts curtos, não bloqueantes
- [x] Seletor de data com atalhos (Amanhã / 3 dias / 1 semana) — nunca obrigar o calendário
  - Presente na conclusão da tela “Hoje” e no detalhe do negócio.

## Estados e polimento

- [x] Skeleton loading em todas as listas e no kanban
  - Hoje, funil, contatos, painel e detalhes de contato/negócio.
- [x] Estados vazios úteis em todas as telas (com botão da ação principal)
- [x] Teclados corretos: `tel` (telefone), `email`, `inputmode="decimal"` (valor do negócio)
- [x] Acessibilidade básica: contraste, foco visível, labels, navegação por teclado no desktop
  - `aria-current` na navegação inferior e rótulos nos controles novos.
- [x] `pt-BR` em tudo; datas relativas ("hoje", "ontem", "há 3 dias") e absolutas no tooltip

## Medição (RNF de performance)

- [ ] Medir "Hoje" em 4G simulado (Playwright/DevTools): meta **< 2s com 200 tarefas**
  - Pendente: exige banco/ambiente de execução; a suíte de integração já cobre 200 tarefas no serviço.
- [ ] Teste manual em **Android intermediário real** + iPhone
- [ ] Lighthouse: PWA instalável + performance ≥ 90 nas telas principais

---

**✅ Critério de aceite:** dá para executar a rotina diária inteira (abrir Hoje → WhatsApp → registrar resultado → próxima ação) com uma mão só, no celular, sem zoom e sem espera perceptível.

> ⚠️ Pendências de validação manual e a migration da 010 (`add_public_form_settings`) precisam ser aplicadas no ambiente real.
