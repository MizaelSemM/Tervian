# 010 · Formulário público de captura (site / Instagram)

**Status:** ✅ Concluída (13/11/2026). Slug configurável, ativação, título/mensagem, responsável padrão, embed + QR local e prévia ao vivo.
**Requisitos:** RF-12 (P0)
**Prioridade:** P0 · **Depende de:** 002, 005 (`createLead()`), 007 (tarefa de primeiro contato) · **Bloqueia:** —

---

## Rota pública

- [x] Rota **pública** `/f/[slug]` (slug único por conta), sem autenticação e fora do layout do app
  - O id da conta continua aceito como fallback para links antigos.
- [x] Campos: **nome + telefone** obrigatórios; e-mail e origem opcionais — nunca mais que 3 campos visíveis
  - Origem é registrada automaticamente como `FORM`; os 3 campos visíveis são nome, telefone e e-mail.
- [x] Origem padrão `form` registrada; UTM (source/medium/campaign) capturada em campo oculto se presente na URL
- [x] Reutiliza `createLead()` → contato + negócio "Novo" + **tarefa "Primeiro contato" para hoje**
- [x] Atribuição do responsável: regra definida no `000` (admin da conta / responsável configurado / rodízio)
  - Responsável configurável em `/configuracoes`; sem escolha, usa o primeiro usuário ativo (Admin primeiro).
- [x] Tela de agradecimento configurável ("Recebemos seu contato, responderemos em breve") + redirecionamento opcional para WhatsApp da empresa
  - Implementado como botão “Falar no WhatsApp” na tela de agradecimento (sem redirect automático).

## Configuração pelo admin

- [x] Área em Configurações: ativar/desativar formulário, editar título e mensagem de agradecimento
- [x] **Snippet de embed** (`<iframe>`) com botão copiar + link direto para **bio do Instagram** com QR code
  - QR gerado localmente com `qrcode-generator` (sem serviço externo) e link copiável.
- [x] Preview ao vivo do formulário dentro das configurações

## Proteção contra abuso

- [x] **Rate limit por IP** (Route Handler; ajustar na Vercel)
  - Server Action com mapa em memória (5 envios / 10 min por IP e instância); Redis/Upstash fica para a 015 se necessário.
- [x] Honeypot invisível + validação de tempo de preenchimento (bots preenchem instantâneo)
- [x] Captcha leve (Turnstile) **apenas se** aparecer abuso real no piloto — não bloquear o lançamento por isso
  - Não implementado por decisão: honeypot + tempo + rate limit cobrem o piloto.
- [x] Duplicado por telefone: não cria negócio novo; registra evento "novo contato pelo formulário" na timeline do contato existente
  - `createLead()` devolve `duplicate` sem criar negócio; a action grava `lead.captured_form` no contato existente.

## Mobile e analytics

- [x] Mobile-first: campos grandes, teclado numérico no telefone, botão fixo "Quero falar"
  - Campos `h-12`, telefone `type=tel`/`inputMode=tel`; o formulário curto mantém o botão logo abaixo dos campos (sem sticky para não ser coberto pelo teclado).
- [x] Evento `lead_captured` (PostHog) com origem e tempo de preenchimento
- [x] Página pública indexável? **Não** — `noindex` por padrão (dados de configuração da empresa)

---

**✅ Critérios de aceite (RF-12):** enviar o formulário cria lead visível na tela "Hoje" do responsável em segundos; spam básico bloqueado sem captcha; snippet copiável funciona em site externo.

> ⚠️ Migration pendente de aplicação no Supabase: `20261113120000_add_public_form_settings` (`npm run db:migrate`).
