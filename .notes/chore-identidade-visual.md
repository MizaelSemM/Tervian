# Chore · Identidade visual — “Pauta de campo”

Branch: `chore/identidade-visual`
Status: em revisão (PR para `master`)
Escopo aprovado: fundação (tokens + tipografia) + shell + Hoje + login/cadastro + Funil. Contatos, Painel e Configurações herdam a base, com ajustes pontuais.

## Brief

O Tervian é um CRM de follow-up para pequenas equipes de vendas brasileiras. O vendedor abre o app no celular, muitas vezes na rua, para responder uma pergunta só: **quem eu chamo agora e o que acontece depois?** O visual precisa ser rápido de ler, confiável e humano — não um dashboard genérico de SaaS.

A tela “Hoje” é a pauta do dia. O Funil é a mesa de trabalho. O login é a primeira impressão. O resto do app deve parecer parte da mesma operação.

## Direção: Pauta de campo

Caderno de trabalho bem cuidado, traduzido para uma interface digital: papel frio, tinta forte, uma cor de ação e estrutura visível por réguas e alinhamento — não por cartões flutuantes.

### Paleta

| Token                | Claro     | Uso                                                      |
| -------------------- | --------- | -------------------------------------------------------- |
| `--background`       | `#F4F5F0` | Papel frio (sem creme)                                   |
| `--foreground`       | `#191D1B` | Tinta                                                    |
| `--card`             | `#FFFFFF` | Superfícies de trabalho                                  |
| `--primary`          | `#2447D8` | Cobalto: ação, links, item ativo, etapa “hoje”           |
| `--primary-hover`    | `#1B36B0` | Hover do cobalto                                         |
| `--secondary`        | `#E7EAF5` | Apoio frio                                               |
| `--muted`            | `#EAECE5` | Fundo de coluna, hover, campos discretos                 |
| `--muted-foreground` | `#5F665F` | Texto secundário (5,4:1 no papel)                        |
| `--border`           | `#D9DCD4` | Réguas e contornos                                       |
| `--destructive`      | `#C43D2E` | Atraso e perda — nunca decoração                         |
| `--success`          | `#167A5B` | Concluído e “em dia”                                     |
| `--warning`          | `#9A5B00` | Próximo do prazo / atenção                               |
| `--ring`             | `#2447D8` | Foco visível                                             |

Dark mode mantém a mesma lógica, com tinta como fundo e cobalto claro para ação. Não há toggle hoje; os tokens ficam definidos para não quebrar o sistema.

### Tipografia

- **Archivo** (variável, eixo `wdth` incluso) para toda a interface. Grotesca latino-americana, com personalidade em pesos altos e leitura boa em tamanhos pequenos.
- Palavra-marca e títulos-chave usam `font-stretch` levemente expandido; corpo e dados ficam na largura normal.
- Números tabulares em valores, contadores e datas.
- Uma família só. Sem serifada, sem monoespaçada em rótulos.
- Datas e rótulos em caixa de frase (“Sexta-feira, 20 de novembro”), não em caixa alta com tracking.

### Layout

```text
SHELL
┌─────────────────────────────────────────────────────────────┐
│ Tervian   Hoje  Negócios  Contatos  Painel  Equipe  Config. │  ← régua inferior
│                                        Buscar  Ana  Sair    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  conteúdo alinhado à esquerda, largura limitada             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

HOJE
┌───────────────────────────────────────────────┐
│ Sexta-feira, 20 de novembro                   │
│ Olá, Ana                                      │  ← data ancora, saudação
│ Estas são as conversas que pedem ação hoje.   │
│ ┌───────────┬───────────┬───────────────────┐ │
│ │ Atrasadas │ Hoje      │ Concluídas hoje   │ │  ← barra de resumo, não 3 cards
│ │ 1         │ 6         │ 0                 │ │
│ └───────────┴───────────┴───────────────────┘ │
│                                               │
│ Atrasadas  1                                  │
│ ┃ Carla Mendes            Atrasada há 1 dia   │  ← trilha vermelha
│ ┃ Compra de 20 unidades · Novo                 │
│ ┃ (11) 99101-0001   R$ 1.200,00                │
│ ┃ [WhatsApp] [Ligar] [Mensagem] [Concluir]     │
│ └─────────────────────────────────────────────┘
│                                               │
│ Hoje  6                                       │
│ ┃ Otávio Ramos            Hoje, 09:30         │  ← trilha cobalto
│ …                                             │
└───────────────────────────────────────────────┘

FUNIL
┌──────────────────────────────────────────────────────────────┐
│ Negócios                            [Novo negócio]           │
│ 10 abertos · R$ 68.400,00         [Kanban | Lista]           │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│ │ Novo      3  │ │ Contatado 3  │ │ Proposta  2  │           │
│ │ R$ 12.700    │ │ R$ 15.000    │ │ R$ 13.700    │           │
│ │ ▓▓▓░░ 30%    │ │ ▓▓▓▓░ 50%    │ │ ▓▓▓▓▓ 70%    │           │  ← probabilidade real
│ │ ┌──────────┐ │ │ ┌──────────┐ │ │              │           │
│ │ │ card     │ │ │ │ card     │ │ │              │           │
│ │ └──────────┘ │ │ └──────────┘ │ │              │           │
│ └──────────────┘ └──────────────┘ └──────────────┘           │
└──────────────────────────────────────────────────────────────┘

LOGIN (desktop)
┌───────────────────────────┬──────────────────────────┐
│ Tervian                   │  Entrar                  │
│                           │  Acesse o painel…        │
│                           │  E-mail [__________]     │
│ Quem chamar hoje,         │  Senha  [__________]     │
│ sem adivinhar.            │  [ Entrar ]              │
│                           │  Criar conta             │
│ (2º toque como marca d'água)                          │
└───────────────────────────┴──────────────────────────┘
```

Alinhamento à esquerda em todo o app. Larguras: Hoje 768px, Funil 1280px, formulários 420px.

### Princípios

1. **A pauta manda.** Data, atraso e próxima ação são a hierarquia. O resto é apoio.
2. **Estrutura é informação.** A trilha lateral diz “atrasada” ou “hoje”; a barra da etapa diz a probabilidade. Nada é decorativo.
3. **Uma cor de ação.** Cobalto só onde se clica ou onde o dia pede ação. Vermelho só para atraso/perda. Verde só para concluído.
4. **Menos cartão, mais lista.** Tarefas são linhas de uma pauta; o kanban usa colunas e cartões porque o conteúdo é arrastável.
5. **Um gesto forte.** O painel tipográfico do login é o momento de marca; o resto fica quieto.
6. **Nada de tell de template.** Sem caixa alta com tracking, sem separador “·”, sem em dash decorativo, sem monoespaçado em rótulo, sem gradiente, sem sombra difusa.

## Revisão contra o brief

- O plano não cai no cluster “creme + serifada + terracota”: a base é fria, a tipografia é uma grotesca e o acento é cobalto.
- Não é “quase-preto + verde ácido”: a tinta tem temperatura e o cobalto é uma cor de trabalho.
- Não é o kit SaaS de cartões idênticos: Hoje vira lista com trilha; o cartão fica onde há drag-and-drop.
- A escolha específica do Tervian é a **pauta**: a data ancora a tela, a trilha marca o tempo e a probabilidade aparece como barra na etapa do funil. O “2º toque” do login é a assinatura da marca.

## Fora de escopo

- Novas features, mudanças de fluxo, migration ou alteração de regra de negócio.
- Rebrand completo de ícones/ilustrações e troca dos ícones PWA.
- Redesenho profundo de Contatos, Painel e Configurações; eles herdam tokens e recebem correções pontuais de consistência.

## O que mudou

### Fundação

- `app/globals.css`: tokens claros/escuros da paleta, `primary-hover`, `success`/`warning` com variantes suaves, cores de gráfico sem vermelho/verde semânticos, `--radius: 0.5rem` e utilitários `.font-brand` e `.text-page-title`.
- `app/layout.tsx`: Archivo variável (eixo `wdth`) no lugar da Geist Sans; Geist Mono permanece só para o texto de confirmação de exclusão. `themeColor` acompanha o papel.
- `app/manifest.ts`: `background_color` e `theme_color` do PWA alinhados ao papel frio.
- Componentes base: botão primário com hover cobalto escuro, outline branco, badge retangular, card com borda em vez de anel e input branco.

### Shell

- `components/brand.tsx` (novo): palavra-marca com ponto cobalto e variante invertida para o painel de login.
- `components/app-nav.tsx` (novo): navegação desktop com sublinhado cobalto no item ativo e `aria-current`.
- `components/mobile-nav.tsx`: alvos de 64px, indicador cobalto no topo e estado ativo.
- `app/(app)/layout.tsx`: header de 64px alinhado ao conteúdo, avatar com iniciais, sair como ação discreta e busca global com atalho.
- `app/(app)/global-search.tsx`: diálogo com a mesma linguagem (branco, borda, foco cobalto).

### Hoje

- Data como âncora, saudação em Archivo e resumo em barra única (Atrasadas / Hoje / Concluídas), com cor só quando há valor.
- Tarefas em lista contínua com trilha lateral (vermelha para atraso, cobalto para hoje), etapa em etiqueta discreta, valor em tinta e responsável com ícone.
- Ações em 2x2 no celular e em linha no desktop; “Concluir” continua sendo o alvo principal.
- Painel de conclusão com resultado, próxima data, fechamento ganho/perdido e estados semânticos de sucesso/atenção.

### Login e cadastro

- Split no desktop: painel cobalto com “Quem chamar hoje, sem adivinhar.” e “2º” como marca d’água; formulário à direita, sem cartão.
- No celular, o painel de marca some e o formulário ocupa a tela com a mesma tipografia.
- Rótulos acessíveis (`E-mail`, `Senha`, `Nome da empresa`, `Seu nome`) e fluxos preservados.

### Funil

- Colunas de 296px com contagem, valor e barra de probabilidade real da etapa.
- Cartões sem sombra, contato e responsável separados, chips de próxima ação em cobalto e “dias sem atividade” em atenção/vermelho.
- Abas Kanban/Lista com sublinhado; lista mobile com metadados em linha e sem separador “·”.
- Busca e filtros com campo e botão na mesma linha no celular.

### Telas herdadas

- Contatos, Painel, Configurações, Equipe, carteira, métricas, detalhes, importação e páginas públicas receberam o título padronizado (`.text-page-title`), botões e inputs coerentes.
- Painel: KPIs sem caixa alta, ícones e números em tokens semânticos, gráficos em cobalto claro/ocre.
- Contatos: busca inline, lista com metadados separados por espaço e ações de 36px.
- E2E: expectativas de texto acompanharam a nova copy (vírgulas no lugar de “·”) e o card do kanban passou a ser escopado pelo link do negócio, porque contato e título agora são nós distintos.

## Critérios de aceite

- [x] Tokens claro/escuro, tipografia e componentes base aplicados.
- [x] Shell desktop/mobile com estado ativo e boa leitura em 390px.
- [x] Hoje redesignada sem perder conclusão em dois toques, filtro de vendedor e desfazer.
- [x] Login e cadastro com a nova primeira impressão; fluxos e rótulos acessíveis preservados.
- [x] Funil com colunas, cartões, drag-and-drop e alternância kanban/lista preservados.
- [x] `format:check`, `lint`, `typecheck`, `test` e `build` verdes. E2E verde nos fluxos afetados; importação de 5.000 linhas limitada pelo banco remoto no ambiente local (detalhe em Checks).
- [x] Screenshots antes/depois revisados em desktop e mobile (login, cadastro, Hoje, Funil, Contatos, Painel e Configurações).

## Checks

- `npm run format:check` — verde.
- `npm run lint` — verde.
- `npm run typecheck` — verde.
- `npm test` — 25 arquivos, 197 testes verdes.
- `npm run build` — verde (Next 16.4.6/Turbopack, 29 páginas, 0 erros de tipo).
- `npx playwright test` — suíte completa encontrou 7 falhas: 6 eram expectativas antigas de copy/escopo do card, corrigidas nos testes (`·` → vírgula; card do kanban escopado pelo link). Reexecução dos arquivos afetados: 12 verdes, 3 skips e apenas a importação de 5.000 linhas estourou o timeout de 300s. O gargalo é do ambiente: o banco é um pooler remoto e cada lote de 100 linhas levou ~100s; após 5 minutos o import havia processado só 300 de 5.000 linhas, tanto no dev quanto no build de produção. O CI roda contra Postgres local, onde o cenário é rápido. Nenhuma linha do serviço de importação foi alterada; smoke de 200 linhas em build de produção validou pré-visualização e relatório com a nova copy.
- Revisão visual: screenshots em `/tmp/opencode/shots-before` e `/tmp/opencode/shots-final` (desktop 1440×960 e mobile 390×844).
