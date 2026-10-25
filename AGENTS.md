<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Fluxo de branches e PRs

- Nunca commite direto no `master`. Crie uma branch `NNN-slug` (tarefa) ou `chore/slug` (manutenção) a partir do `master` atualizado.
- Rode `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` antes de publicar.
- Publique a branch e abra um PR para `master` usando `.github/pull_request_template.md`; o PR é o checkpoint revisável. Sem `gh` instalado, entregue o link `https://github.com/MizaelSemM/Tervian/pull/new/<branch>`.
- Atualize o `.notes/` da tarefa e o `.notes/todo.md` no mesmo PR.
- Não inclua no commit mudanças fora do escopo (ex.: exclusões em `.claude/` e `.windsurf/`).
