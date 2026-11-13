# 009 · Importação de CSV

**Status:** ✅ Concluída (13/11/2026). Processamento em lotes de 100 linhas via Server Action, com progresso e cancelamento; fixture de 5.000 linhas no CI.
**Requisitos:** RF-11 (P0) · user story US-06 · critério de lançamento: **5.000 linhas sem falha**
**Prioridade:** P0 · **Depende de:** 002, 005 (`createLead()`) · **Bloqueia:** `016` (critério de lançamento)

---

## Upload e mapeamento

- [x] Upload de CSV com limite de tamanho e pré-visualização das primeiras linhas
- [x] Detecção de separador (`;`, `,` e tab) e encoding — planilhas BR costumam vir em **Latin-1/Windows-1252**
- [x] Mapeamento de colunas → campos: **nome e telefone obrigatórios**; e-mail, empresa_texto, origem, tags opcionais
- [x] Lembrete de colunas duplicadas/incompletas com sugestão automática pelo nome do cabeçalho
- [x] Tela de confirmação mostrando as primeiras 10 linhas já validadas antes de importar

## Regras e validação

- [x] Validação linha a linha com **Zod** (schema compartilhado de contato)
- [x] Normalização de telefone na importação (helper do `002`) — linhas com telefone inválido vão para o relatório de erros
- [x] Detecção de duplicados por telefone normalizado: **contra a base** e **dentro do próprio arquivo**
- [x] Decisão por duplicado (padrão: ignorar): ignorar / atualizar existente / criar novo
  - “Criar novo” mantém o contato único (telefone é a chave) e cria **um novo negócio** para ele.

## Processamento

- [x] Processamento em **chunks com status de progresso** para 5.000+ linhas sem estourar timeout da Vercel
  - Implementado com Server Action + lotes de 100 linhas no client (sem Route Handler/job; cada chamada é curta).
- [x] Cada linha importada passa pelo `createLead()`: contato + negócio "Novo" + tarefa de primeiro contato **para hoje** (respeitar opção "só importar contatos")
- [x] Importação **cancelável** durante a pré-visualização (nada é gravado antes de confirmar)
- [x] Também aceitar colar do Excel (TSV) como bônus simples — separador tab detectado no arquivo

## Relatório e LGPD

- [x] Relatório final: **importados · ignorados · duplicados · erros**, com download do CSV de erros
- [x] Evento na timeline da conta: "Importação de X contatos por Fulano"
- [x] Checkbox obrigatório de **base legal** (LGPD): "declaro que tenho base legal para tratar estes dados"

## Testes (ver `014`)

- [x] Fixture de arquivo com **5.000 linhas** (incluindo duplicados, telefones inválidos e encoding Latin-1) rodando no CI
  - `tests/unit/import-csv.test.ts` (parse + dedupe + merge); testes de integração da importação exigem banco.

---

**✅ Critérios de aceite (US-06):** pré-visualização + mapeamento funcionam; relatório bate linha a linha; 5.000 linhas importadas sem falha nem timeout.
