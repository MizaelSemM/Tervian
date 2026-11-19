# 019 · Modelos de mensagem com variáveis (RF-36)

**Requisito:** RF-36 (modelos com `{nome}`, `{empresa}` e `{vendedor}`, copiáveis ou enviados ao WhatsApp)
**Prioridade:** P1 · **Depende de:** 005 (contatos), 006 (negócios), 007 (Hoje) · **Migration:** nenhuma
**Status:** implementado em 19/11/2026 na branch `019-templates-mensagem`; checks completos verdes.

---

## O que entrou

### Modelos e seed

- Reaproveitado o model `MessageTemplate` que já existia no schema e na migration inicial — nenhuma
  migration nova.
- `lib/message-template.ts`: funções puras de renderização e inspeção de variáveis, compartilhadas
  entre servidor e client (o composer pré-visualiza no navegador).
  - `{nome}` usa o primeiro nome do contato; `{empresa}` cai para “sua empresa” e `{vendedor}`
    para “equipe” quando o dado está vazio.
  - `{ Nome }` e `{EMPRESA}` também funcionam; o texto fora das três variáveis fica intacto.
- `lib/schemas/message-template.ts`: Zod valida nome único de 2–80 caracteres, mensagem de 2–1.000
  e recusa qualquer `{variável}` desconhecida com mensagem em pt-BR.
- `server/services/message-templates.ts`: cinco modelos padrão por conta (“Primeiro contato”,
  “Retorno combinado”, “Proposta enviada”, “Fechamento” e “Reativação”), CRUD com nome único sem
  caixa, validação de que a etapa sugerida pertence à conta e leitura isolada pelo tenant.
- IDs determinísticos (`default-message-template-<accountId>-<key>`), então o seed é idempotente.
  O cadastro cria os modelos junto do funil e dos motivos de perda; contas antigas recebem os
  padrões de forma lazy no primeiro acesso (`ensureDefaultMessageTemplates`).
- Rollback do cadastro atualizado para apagar templates e cadências antes das etapas.

### Configurações (ADMIN)

- `message-templates-settings.tsx`: criar, editar e excluir modelos, com etapa sugerida opcional.
- `template-actions.ts`: server actions protegidas por `withAdmin`, revalidando `/configuracoes` e
  `/hoje`; vendedores não veem a seção (a página inteira já é ADMIN).
- A leitura dos modelos em `/hoje`, contato e negócio é liberada para vendedores.

### Composer e uso

- `components/message-composer.tsx`: botão “Mensagem pronta” abre um `<dialog>` nativo com:
  - lista de modelos da conta, com os da etapa atual marcados como “Sugerido” e ordenados primeiro;
  - prévia editável da mensagem com as variáveis já preenchidas;
  - “Copiar” e “Abrir no WhatsApp” (`wa.me?text=`), com fallback quando o telefone é inválido.
- Integrado na fila do dia (`/hoje`) com `stageId` e empresa do contato, e nos detalhes de contato e
  negócio.
- `whatsappLinkBR()` passou a aceitar texto opcional e a encodar a mensagem no link.

### Testes

- `tests/unit/message-template.test.ts`: renderização, caixa/espaços, fallbacks, variáveis
  desconhecidas e schema.
- `tests/unit/phone.test.ts`: link com mensagem encodada e texto vazio.
- `tests/integration/message-templates.test.ts`: seed idempotente, CRUD, nome único, etapa
  sugerida, criação no cadastro e isolamento entre contas.
- `e2e/message-templates.spec.ts`: admin cria o modelo em Configurações, usa na tela “Hoje”
  com `{nome}`/`{vendedor}` preenchidos e confere o link do WhatsApp; edição e exclusão.

### Correção de mobile encontrada no E2E

- O snippet de embed do formulário público estourava a largura de Configurações no mobile: o
  layout viewport ia para 1310px, o conteúdo era cortado e o botão “Criar modelo” ficava sob o
  card anterior. O grid passou a usar `grid-cols-1` (trilha `minmax(0, 1fr)`) e o `<pre>` do
  embed quebra linha (`break-all whitespace-pre-wrap`).

---

## Decisões

- **Sem migration:** o schema já previa `message_templates` desde a 002; o RF-36 era só a camada de
  uso.
- **Modelos padrão em toda conta:** o vendedor consegue mandar a primeira mensagem no dia 1, sem
  pedir configuração ao admin. Se o admin excluir todos, os padrões voltam na próxima leitura —
  mesma lógica dos motivos de perda.
- **`{vendedor}` é o nome completo de quem está logado**, não o dono do negócio: a mensagem sai em
  nome de quem está enviando.
- **Uma etapa sugerida por modelo:** o composer prioriza os modelos da etapa do negócio sem
  esconder os demais; não é uma regra de automação (isso fica para as cadências da RF-33).
- **Variável desconhecida é erro, não texto literal:** evita enviar `{cidade}` para o cliente por
  engano.
- **CRUD só para ADMIN:** vendedores leem e usam; a padronização da comunicação é decisão da conta.
- **Diálogo nativo:** foco preso, Esc e backdrop sem dependência nova de UI.

---

## Checks

- [x] `npm run format:check`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test` — 189 testes (unidade + integração, 23 arquivos)
- [x] `npm run build`
- [x] `npx playwright test e2e/message-templates.spec.ts` — 4/4 (2 cenários × mobile/desktop)

---

## Fora do escopo / próximos P1

- RF-33 cadências usando `template_id` para gerar tarefas automáticas.
- RF-34 alerta de negócio parado, RF-24 edição de etapas, RF-43 tags/filtros, RF-35 resumo diário
  e RF-05 Google login.
- Cobertura mínima de `server/services/` e endpoint `/api/health` continuam como dívida da 016.
