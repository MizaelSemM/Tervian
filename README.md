# Tervian

### CRM inteligente para organizar vendas, acompanhar oportunidades e nunca perder o próximo follow-up.

O **Tervian** é um SaaS de gestão comercial desenvolvido para pequenas equipes de vendas que precisam organizar contatos, acompanhar negociações e manter uma rotina consistente de follow-up.

Mais do que armazenar contatos, o Tervian ajuda equipes a entender **quem precisa ser contatado, qual é a próxima ação e quais oportunidades precisam de atenção**.

<p align="center">
  <a href="https://tervian.vercel.app">Acessar Tervian</a> ·
  <a href="https://github.com/MizaelSemM/Tervian">Repositório</a>
</p>

---

## Visão geral

O principal objetivo do Tervian é transformar o acompanhamento comercial em um processo organizado e previsível.

A plataforma conecta contatos, negócios, tarefas e histórico de interações em um único ambiente.

### Funcionalidades

- **Dashboard gerencial:** indicadores comerciais, previsão de vendas, oportunidades paradas e desempenho da equipe.
- **Gestão de contatos:** cadastro, edição, busca global, histórico e organização de leads.
- **Funil de vendas:** visualização Kanban com movimentação de negócios entre etapas.
- **Follow-up inteligente:** tarefas atrasadas, agendadas para hoje e próximas ações.
- **Histórico e notas:** registro de interações, atividades e anotações em contatos e negócios.
- **Importação CSV:** importação em lote com mapeamento de colunas, pré-visualização e relatório de resultados.
- **Formulários públicos:** captura de leads por meio de links compartilháveis.
- **Gestão de equipe:** convites, permissões e controle de usuários.
- **Controle de acesso:** permissões específicas para administradores e vendedores.

## Tecnologias utilizadas

| Tecnologia | Aplicação |
|---|---|
| Next.js 16 | Framework e arquitetura da aplicação |
| React 19 | Interface e componentes |
| TypeScript | Tipagem estática |
| Tailwind CSS 4 | Estilização |
| shadcn/ui + Base UI | Componentes de interface |
| PostgreSQL | Banco de dados |
| Prisma ORM 7 | ORM e gerenciamento de dados |
| Better Auth | Autenticação e sessões |
| Zod 4 | Validação de dados |
| dnd-kit | Drag and drop do Kanban |
| Recharts | Visualização de indicadores |
| Vitest | Testes unitários e integração |
| Playwright | Infraestrutura de testes E2E |

## Arquitetura e decisões técnicas

O Tervian utiliza uma arquitetura organizada em camadas, separando interface, autenticação, validação e regras de negócio.

### Multi-tenancy

Uma das principais decisões arquiteturais foi desenvolver o sistema com suporte a múltiplas empresas desde o início.

Cada empresa possui seus próprios usuários, contatos, negócios e tarefas, compartilhando a mesma infraestrutura sem compartilhar seus dados.

O isolamento é implementado por meio de:

- `account_id` associado aos dados de domínio.
- `AsyncLocalStorage` para contexto da empresa por requisição.
- `tenantDb()` para aplicar automaticamente o escopo da conta nas operações Prisma.
- `ownerScope()` para controlar o acesso aos registros conforme o papel do usuário.
- Testes de integração para verificar o isolamento entre empresas.

### Separação de responsabilidades

A aplicação segue uma divisão clara:

- **App:** páginas, componentes e Server Actions.
- **Server Services:** regras de negócio e operações.
- **Lib:** autenticação, sessão, validação, contexto e infraestrutura.
- **Prisma:** modelos, relacionamentos e migrations.
- **Tests:** testes unitários e de integração.

A interface não acessa o banco diretamente. As operações passam pelos serviços do servidor, que validam permissões e contexto antes de executar consultas.

## Como funciona o fluxo comercial

O fluxo central do Tervian foi pensado para manter todas as oportunidades com uma próxima ação definida.

1. Um lead é cadastrado manualmente, importado ou capturado por formulário público.
2. O sistema cria o contato e uma oportunidade no funil.
3. Uma tarefa de primeiro contato é criada.
4. O vendedor acompanha suas atividades na tela **Hoje**.
5. Após cada interação, registra o resultado e agenda a próxima ação.
6. Quando a negociação termina, o negócio é marcado como ganho ou perdido.

## Estrutura do projeto

```text
app/
  (auth)/          # Autenticação e cadastro
  (app)/           # Área autenticada
  api/             # Endpoints da aplicação
  f/               # Formulários públicos

components/
  ui/              # Componentes de interface

lib/
  schemas/         # Schemas de validação
  auth.ts          # Configuração de autenticação
  session.ts       # Sessões e permissões
  tenant-context.ts
  tenant-prisma.ts
  prisma.ts

server/
  services/        # Regras de negócio
  signup.ts
  invites.ts
  team.ts

prisma/
  schema.prisma
  migrations/
  seed.ts

tests/
  unit/
  integration/

e2e/
```

## Executando localmente

### Pré-requisitos

- Node.js 22+
- npm
- PostgreSQL
- Git

### 1. Clone o repositório

```bash
git clone https://github.com/MizaelSemM/Tervian.git

cd Tervian
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie seu arquivo `.env` utilizando o `.env.example` como referência, caso disponível.

Configure as credenciais do PostgreSQL e as demais variáveis exigidas pelo projeto em `lib/env.ts`.

### 4. Configure o banco de dados

```bash
npm run db:deploy
```

Para popular o banco com dados de demonstração:

```bash
npm run db:seed
```

### 5. Inicie a aplicação

```bash
npm run dev
```

Acesse:

```text
http://localhost:3000
```

## Testes e qualidade

O projeto utiliza ferramentas automatizadas para manter a qualidade do código.

```bash
npm test
npm run lint
npm run typecheck
npm run format:check
npm run build
```

Para executar os testes E2E:

```bash
npm run e2e
```

> O Playwright está configurado, mas a suíte E2E ainda está em desenvolvimento.

## Roadmap

O desenvolvimento está organizado em tasks incrementais.

- [x] Fundação e decisões arquiteturais
- [x] Modelagem do banco de dados
- [x] Autenticação e gestão de usuários
- [x] Isolamento multi-tenant
- [x] Gestão de contatos
- [x] Funil de vendas e negócios
- [x] Follow-up e tarefas
- [x] Histórico, notas e busca global
- [x] Importação de contatos via CSV
- [x] Formulários públicos
- [x] Dashboard gerencial e carteira de negócios
- [ ] PWA e experiência mobile aprimorada
- [ ] Evolução de segurança e LGPD
- [ ] Ampliação dos testes automatizados
- [ ] Funcionalidades avançadas de gestão e lançamento

## Status do projeto

O Tervian está em desenvolvimento ativo. O núcleo de CRM, gestão comercial, autenticação, isolamento multi-tenant e funcionalidades gerenciais já foi implementado.

As próximas etapas estão concentradas em aprimorar a experiência mobile, ampliar a segurança e preparar o produto para utilização por empresas.

---

## Desenvolvido por

**Mizael**

Desenvolvedor Full Stack em formação, interessado em arquitetura de software, desenvolvimento de produtos SaaS e soluções que resolvem problemas reais.

- GitHub: [@MizaelSemM](https://github.com/MizaelSemM)
- LinkedIn: [Meu perfil](https://www.linkedin.com/)

---

<p align="center">
  <strong>Tervian — Mais organização, mais acompanhamento, melhores decisões.</strong>
</p>
