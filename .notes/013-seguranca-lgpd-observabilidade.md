# 013 · Segurança, LGPD e observabilidade de produto

**Requisitos:** seções 11 (RNF), 17 (riscos) e 4 (métricas) do PRD — **obrigatório para lançar**
**Prioridade:** P0 · **Depende de:** 001, 003, 004 · **Bloqueia:** `016`
**Status:** implementado no código em 14/11/2026; pendências externas listadas no fim.

---

## Segurança

- [x] HTTPS em tudo (padrão Vercel) + headers de segurança — CSP básica, `X-Frame-Options`
      (exceto `/f/*`, que é embedável), `X-Robots-Tag: noindex` nas rotas privadas,
      HSTS em produção, `Permissions-Policy` e `Referrer-Policy` (`proxy.ts`).
- [x] Hash forte de senha (scrypt do Better Auth), sessões httpOnly/SameSite com expiração
      e revogação na troca de senha (tarefa 003; configuração em `lib/auth.ts`).
- [x] Rate limit em login/cadastro/recuperação (Better Auth, 3 req/10s e 5/5min) e no
      formulário público (limite em memória por IP em `app/f/[slug]/actions.ts`).
- [ ] Backups **diários** do Postgres com **teste de restore documentado** — procedimento
      escrito em `.notes/lgpd-operacao.md`; falta executar o restore no Supabase/Vercel
      (depende do painel do dono) e anexar a evidência no PR de lançamento.
- [x] `npm audit` + Dependabot no CI: `.github/dependabot.yml` (npm semanal + Actions mensal)
      e step `npm audit --omit=dev --audit-level=high` no workflow.
- [x] Checklist de revisão de PR: itens de segurança (sessão + `account_id` em todo
      Server Action/Route Handler) e LGPD no `.github/pull_request_template.md`.
- [x] Logs sem dado pessoal: `lib/privacy.ts` mascara e-mail/telefone (`scrubErrorText`) e
      remove chaves sensíveis (`sanitizeAnalyticsProps`); usados por `lib/analytics.ts` e
      `lib/observability.ts`.

## LGPD (cliente = controlador · produto = operador)

- [x] Termos de uso e política de privacidade publicados em `/termos` e `/privacidade`
      (indexáveis; linkadas no cadastro, no formulário público e nas configurações).
- [x] Base legal registrada no cadastro (`Account.termsAcceptedAt` + `termsVersion`) e na
      importação de CSV (checkbox + registro da declaração).
- [x] **Exportação de dados** por solicitação: `GET /api/lgpd/export` (conta inteira, ADMIN)
      e `?contato=<id>` (contato + negócios/tarefas/notas/timeline) em JSON; botões no
      detalhe do contato e em `/configuracoes`.
- [x] **Exclusão** por solicitação: `purgeContact()` faz hard delete de contato, negócios,
      tarefas, notas e timeline, com confirmação digitada `EXCLUIR`, restrita a ADMIN e
      auditoria `contact.purged` sem PII. Procedimento em `.notes/lgpd-operacao.md`.
- [x] Registro de acesso/alteração: timeline de domínio (tarefa 008) + auditoria de exclusão
      LGPD. Log de acesso bruto fica no provedor de infraestrutura; não guardamos IP no app.
- [x] Documento interno de operação: `.notes/lgpd-operacao.md` (onde ficam os dados,
      retenção, backup/restore e como atender um titular).

## Observabilidade e analytics (métricas da seção 4)

- [x] **Sentry** via DSN, sem SDK (`lib/observability.ts`): contexto de conta/rota/usuário
      (apenas ID) e mensagem higienizada. **Falta configurar `SENTRY_DSN` em produção** e
      criar o alerta por e-mail de erros novos no painel do Sentry.
- [x] **PostHog** via HTTP (`lib/analytics.ts`) com os eventos do PRD:
      `user_opened_app`, `today_viewed`, `task_completed`, `deal_moved`, `lead_created`,
      `next_action_set`, `deal_won`, `deal_lost`. **Falta configurar
      `NEXT_PUBLIC_POSTHOG_KEY`/`NEXT_PUBLIC_POSTHOG_HOST` em produção.**
- [x] Todo evento carrega `account_id` e `role` vindos do contexto de tenant
      (`lib/tenant-context.ts` + `lib/session.ts`).
- [x] **Dashboard interno das 6 métricas do PRD** em `/painel/metricas` (ADMIN):
      vendedores ativos (7 dias), negócios com próxima ação, tarefas do dia concluídas,
      mediana do tempo de cadastro (30 dias), negócios parados 7+ dias e conversão (90 dias).
- [x] Evento com timer real no cadastro de lead (`created_in_seconds`, captura no formulário
      e no cadastro manual) + payload `seconds` na timeline para o cálculo da mediana.
- [ ] Meta de disponibilidade 99,5%: monitor de uptime (Vercel/Checkly) — depende da conta
      do dono; anotado no `.notes/lgpd-operacao.md` e no checklist do 016.

---

## Riscos aceitos (revisar a cada release do Next)

- **`braces` (dev-only, 5 advisories "high" no npm audit):** vulnerabilidade de DoS por padrão deeply nested em glob. Chega via `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. **Não vai para produção** (é ferramenta de lint) e o "fix" sugerido pelo npm é um downgrade quebrado do eslint-config-next. Ação: revisar quando o Next publicar versão com a árvore atualizada.
- **`eslint@9.39.5` marcado como "no longer supported" pelo npm:** o template do Next 16 fixa `^9`. Revisar quando o `eslint-config-next` migrar para o ESLint 10.

---

## Pendências externas (bloqueiam o lançamento, não o código)

1. [x] Aplicar as migrations no Supabase: `20261113120000_add_public_form_settings` (010) e
       `20261113160000_add_account_terms` (013) com `npm run db:migrate` — aplicadas em
       14/11/2026 e verificadas em `_prisma_migrations`.
2. [ ] Configurar `SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY` e `NEXT_PUBLIC_POSTHOG_HOST` na Vercel.
3. [x] Corrigir `DATABASE_URL` e `DIRECT_URL` na Vercel (Production e Preview) e fazer
       **Redeploy** — validado em produção em 14/11/2026: o deploy novo do `master` passou
       a usar a env correta, o `P1000` sumiu e um signup real criou a conta e caiu em
       `/hoje` (conta de teste removida em seguida).
4. [ ] Executar e documentar o teste de restore do backup diário do Postgres.
5. [ ] Ativar o monitor de uptime (99,5%) com alerta por e-mail/WhatsApp.
6. [ ] Criar o alerta de erros novos no Sentry e o projeto do PostHog com os eventos acima.

**✅ Critério de aceite:** termos publicados; testes de isolamento no CI; métricas de adoção disponíveis sem trabalho manual no dia 1 do piloto; restauramos um backup de teste com sucesso.
