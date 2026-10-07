# 0002 — Monorepo e ferramentas de qualidade

- Status: aceita
- Data: 2026-10-07

## Contexto
A Fase 0 pede estrutura de pastas, lint/format, testes e CI. `docs/engenharia.md` define o monorepo e deixa em aberto a escolha entre pnpm e npm workspaces e entre `eslint-plugin-boundaries` e `dependency-cruiser` para verificar a regra de dependência.

## Decisão
- **pnpm workspaces** (`apps/*`, `packages/*`). O pnpm é estrito: um pacote só importa o que declara no próprio `package.json`, o que já reforça as fronteiras entre pacotes. A versão fica fixada em `packageManager`.
- **Pacotes internos consumidos como código-fonte TypeScript** (`"exports": "./src/index.ts"`), sem etapa de build por pacote. Vitest e o empacotador do Electron compilam direto; `tsc` só faz checagem de tipos (`noEmit`).
- **TypeScript 6.0** em modo `strict` (com `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`). O TypeScript 7 (compilador nativo) já saiu, mas o typescript-eslint ainda exige `< 6.1`. Migrar quando o lint suportar.
- **ESLint** (flat config, `strictTypeChecked` do typescript-eslint) + **Prettier**.
- **Vitest** com um projeto por pacote.
- **dependency-cruiser** para a regra de dependência (`.dependency-cruiser.cjs`): o domínio não importa nada de fora (nem npm, nem APIs do Node), a aplicação só conhece o domínio, e infraestrutura e apresentação só se encontram nos apps. Escolhido por funcionar fora do ESLint, com regras por caminho, detecção de ciclos e dependências do Node.
- O pacote de domínio compila com `"types": []`, então nem os tipos do Node estão disponíveis nele.
- **Python (serviço de voz):** uv, Ruff, mypy `strict` e pytest.
- **CI no GitHub Actions** com dois jobs (TypeScript e Python) a cada push na `main` e em pull requests.
- **Pacotes criados sob demanda:** cada pasta do monorepo nasce na fase que a usa (ex.: `apps/desktop` e `packages/avatar` na Fase 1, `packages/i18n` com a primeira interface), em vez de pastas vazias agora.

## Consequências
- `pnpm check` roda localmente a mesma verificação da CI.
- Pacote novo precisa entrar no `.dependency-cruiser.cjs` para ter as fronteiras verificadas. Quando `apps/` for criada, ela entra no script `check:boundaries`.
- A troca para o TypeScript 7 fica pendente até o ecossistema de lint acompanhar.
