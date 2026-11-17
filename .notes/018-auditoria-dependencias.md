# 018 · Auditoria de dependências e vulnerabilidades

**Tipo:** manutenção de segurança · **Branch:** `chore/security-audit-fixes` · **Migration:** nenhuma
**Status:** aplicado em 17/11/2026; produção sem vulnerabilidades conhecidas, restando apenas a
cadeia de desenvolvimento do `picomatch` (sem versão corrigida publicada).

---

## Contexto

O `npm audit` acusava 23 vulnerabilidades (8 moderadas, 15 altas). Quase tudo vinha de
ferramentas de desenvolvimento — `shadcn`, `eslint-config-next`, `typescript-eslint` e
`vitest` — puxando versões antigas de `fast-uri`, `minimatch` e, principalmente, `picomatch`.

O `node_modules` local também estava em Next 16.4.2 enquanto o `package.json` já fixava
16.4.6; uma instalação limpa resolveu o aviso de segurança do Next.

## O que mudou

- **`fast-uri` 3.1.8 → 3.1.9** (via `npm update`, transitivo) — corrige as quatro
  advisories de URI/percent-encoding.
- **`typescript-eslint` 8.71.2 → 8.73.0** (transitivo do `eslint-config-next`, via
  `npm update`) — corrige as advisories moderadas e passa a usar `minimatch` 11 nas
  ferramentas de lint.
- **`shadcn` mantido.** A tentativa de removê-lo das `devDependencies` quebrou o build:
  `app/globals.css` importa `shadcn/tailwind.css`. O pacote é necessário em build time, não
  só como CLI.
- **CI:** a auditoria de produção passou a rodar
  `npm audit --omit=dev --omit=optional --audit-level=high`. O `better-auth` declara
  `vitest` como peer **opcional**; sem `--omit=optional`, o npm trata a árvore de testes
  como produção e acusa o `picomatch` de dev/build como se fosse runtime.

## Risco residual: picomatch (dev/build)

- Advisory: [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
  (CVE-2026-112366), ReDoS via extglobs repetidos de um único ramo.
- **Não existe versão corrigida publicada** (`patched versions: none`; a 4.0.7 é a última).
  O PR upstream [micromatch/picomatch#194](https://github.com/micromatch/picomatch/pull/194)
  segue aberto.
- O `npm audit` completo ainda mostra **22 avisos** (2 moderados e 20 altos), todos em
  ferramentas de desenvolvimento e encadeados no `picomatch`
  (`vitest`, `vite`, `tinyglobby`, `fdir`, `eslint-config-next`, `typescript-eslint`,
  `fast-glob`, `micromatch`, `shadcn` e `ts-morph`). Os dois moderados são o `minimatch@10`
  do `ts-morph` e o próprio `ts-morph`.
- **Impacto real:** o padrão vulnerável é um glob controlado por quem desenvolve/testa, não
  por usuário final. O `picomatch` não entra no bundle de runtime do Next (server tracing) e
  a auditoria de produção (`--omit=dev --omit=optional`) está em **0 vulnerabilidades**.
- **Ação quando sair a correção:** remover qualquer workaround, atualizar `picomatch` e rodar
  `npm audit`. Não foi usado override para commit/fork não publicado — evitar dependência de
  código não revisado.

## Verificação

```bash
npm audit --omit=dev --omit=optional   # produção: 0
npm audit                              # dev: 22 (picomatch/minimatch, sem patch upstream)
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```

## Checks

- [x] `npm run format:check`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test` — 165 testes
- [x] `npm run build`
- [x] `npm ci --ignore-scripts` + `prisma generate` a partir do lockfile final
