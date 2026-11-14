# LGPD e operação de dados — Tervian (013)

Documento interno de operação. Não é a política pública (essa fica em
`/privacidade`); aqui está o que a equipe faz quando alguém pede dados, quando
um backup precisa ser restaurado ou quando há um incidente.

**Papéis:** a empresa cliente é a **controladora** dos dados dos contatos dela.
A Tervian é a **operadora** — trata os dados apenas para prestar o serviço,
seguindo as instruções da controladora e a LGPD (Lei 13.709/2018).

---

## 1. Onde os dados ficam

| Dado | Onde | Observação |
| --- | --- | --- |
| Contatos, negócios, tarefas, notas e timeline | Postgres do Supabase (região São Paulo) | um schema, isolamento por `account_id` |
| Usuários, sessões e hashes de senha | Postgres do Supabase (Better Auth) | hash scrypt; sessão em cookie httpOnly |
| Backups do banco | Supabase (backup diário do plano) | retenção conforme o plano contratado |
| Logs de erro | Sentry (quando `SENTRY_DSN` configurado) | sem nome/telefone/e-mail; usuário só por ID |
| Eventos de produto | PostHog (quando configurado) | `account_id` + `role`; sem PII |
| E-mails transacionais | Resend (quando configurado) | convite e redefinição de senha |
| Hospedagem/aplicação | Vercel (região `gru1`) | HTTPS e headers de segurança |

Antes do piloto, confirmar no painel do Supabase: região São Paulo, backup
diário ativo e retenção do plano. Anotar aqui a data da conferência.

---

## 2. Retenção e descarte

- **Conta ativa:** os dados ficam enquanto o serviço for usado.
- **Encerramento da conta:** exportação disponível por **30 dias**; depois os
  dados são eliminados, salvo obrigação legal de retenção (ex.: fiscal).
- **Exclusão a pedido do titular:** o ADMIN usa a exclusão definitiva no
  detalhe do contato (ver seção 4). É hard delete de contato, negócios,
  tarefas, notas e timeline — o direito do titular prevalece sobre o histórico.
- **Exclusão lógica do dia a dia:** contatos excluídos pela UI viram
  `deletedAt` e somem das listas; não contam como atendimento de pedido LGPD.
- **Importação de CSV:** a base legal é declarada no envio e registrada no
  evento `import.completed` (`legalBasis: "declared"`, com data/hora).

---

## 3. Como atender um pedido do titular

1. **Identificar a controladora:** o pedido chega pela empresa cliente. A
   Tervian não responde ao titular diretamente sem alinhamento com ela.
2. **Localizar o titular:** busca global por nome/telefone no app.
3. **Exportar:** no detalhe do contato, botão **Baixar JSON** (ou
   `GET /api/lgpd/export?contato=<id>`). A conta inteira sai em
   `/configuracoes` → **Baixar todos os dados (JSON)** (só ADMIN).
4. **Corrigir:** edição normal do contato.
5. **Eliminar:** ADMIN, no card **Privacidade e dados (LGPD)** do contato,
   digita `EXCLUIR` e confirma. A ação fica na timeline como `contact.purged`
   (sem PII).
6. **Registrar o atendimento:** anotar data, pedido e o que foi feito no canal
   de suporte da controladora. Guardar o JSON exportado apenas pelo tempo
   necessário para entregar ao titular.

> **Expandir os dados exportados:** a rota já inclui conta, usuários, contatos,
> negócios, tarefas, notas e timeline. Se um novo model guardar dado pessoal,
> incluí-lo em `app/api/lgpd/export/route.ts` e no `purgeContact()`
> (`server/services/lgpd.ts`) no mesmo PR.

---

## 4. Backup e teste de restore (obrigatório antes do piloto)

Backup que nunca foi restaurado não é backup. Procedimento:

1. **Conferir o backup diário:** painel do Supabase → Database → Backups.
   Confirmar que existe um backup das últimas 24h. Anotar data e hora.
2. **Restaurar em ambiente de teste:** criar um projeto Supabase descartável
   (ou usar o restore para um branch) e restaurar o backup mais recente.
   **Nunca restaurar por cima do banco de produção.**
3. **Validar com queries de sanidade:**
   ```sql
   select count(*) from accounts;
   select count(*) from contacts where deleted_at is null;
   select count(*) from deals where status = 'OPEN';
   select max(created_at) from timeline_events;
   ```
   Comparar com os números de produção no mesmo horário do backup.
4. **Validar o app:** apontar um ambiente local/staging para o banco restaurado
   (`DATABASE_URL`/`DIRECT_URL`), rodar `npm run build` e abrir `/hoje` e
   `/painel`. Nenhuma migration deve ser necessária.
5. **Destruir o ambiente descartável** e registrar a evidência no PR de
   lançamento: data, tamanho do backup, números conferidos e quem executou.

**Cadência:** testar o restore **uma vez antes do piloto** e depois a cada
trimestre, ou após qualquer mudança de plano/provedor.

---

## 5. Incidente de segurança ou vazamento

1. **Conter:** revogar sessões/credenciais comprometidas (trocar senha revoga
   todas as sessões), desativar usuários suspeitos e, se necessário, pausar o
   deploy.
2. **Avaliar:** quais dados, quantos titulares e quais contas foram afetados.
   Usar a timeline (`contact.purged`, acessos) e os logs do provedor.
3. **Comunicar:** informar a controladora afetada sem demora; com ela, avaliar
   comunicação à ANPD e aos titulares (prazo razoável, conforme a LGPD).
4. **Corrigir:** abrir PR com o fix, teste de regressão e revisão do vetor.
5. **Registrar:** postmortem curto no `.notes/` com linha do tempo, causa,
   impacto e ações. Nunca incluir PII no documento.

**Contato de privacidade:** `privacidade@tervian.dev` (redirecionar para o
responsável real antes do lançamento).

---

## 6. Disponibilidade e monitoramento

- Meta: **99,5% ao mês**.
- Criar monitor de uptime (Vercel/Checkly) apontando para `/login` e `/hoje`
  (expectativa: 200/redirect de login), com alerta por e-mail/WhatsApp.
- Sentry: alerta de **erros novos** por e-mail; conferir semanalmente.
- PostHog: conferir os eventos do PRD e o dashboard interno em
  `/painel/metricas`.

---

## 7. Checklist de launch (LGPD/segurança)

- [ ] Migrations `20261113120000_add_public_form_settings` e
      `20261113160000_add_account_terms` aplicadas (`npm run db:migrate`).
- [ ] Backup diário ativo e restore de teste executado (seção 4).
- [ ] `SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY` e `NEXT_PUBLIC_POSTHOG_HOST`
      configurados na Vercel.
- [ ] Alerta de erros novos no Sentry e monitor de uptime ativos.
- [ ] `privacidade@tervian.dev` com responsável real.
- [ ] Termos e política revisados pelo responsável legal.
- [ ] Equipe sabe onde está este documento e como atender um titular.
