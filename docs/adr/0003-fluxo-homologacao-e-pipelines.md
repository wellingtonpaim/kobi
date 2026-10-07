# 0003 — Fluxo com branch de homologação e pipelines obrigatórios

- Status: aceita
- Data: 2026-10-07

## Contexto
O código precisa chegar à `main` sempre verificado: compilação, lint, fronteiras entre camadas, cobertura de testes e padrão de commits. O Wellington quer commitar numa branch de trabalho e ter o pedido de merge para a `main` aberto automaticamente, passando pelos pipelines antes.

## Decisão
- **Branches:** `homologacao` recebe os commits do dia a dia; a `main` só recebe código por pull request vindo dela.
- **PR automático:** a cada push na `homologacao`, o workflow `pr-homologacao.yml` abre um PR `homologacao → main`, se houver commits novos e nenhum PR aberto. Pushes seguintes entram no mesmo PR.
- **Pipelines (`ci.yml`)**, rodando a cada push na `homologacao` e na `main` e em pull requests para a `homologacao`:
  - **TypeScript:** formatação, lint, compilação (checagem de tipos), fronteiras entre camadas, testes com **cobertura mínima de 90%** (linhas, comandos, funções e ramos).
  - **Python (voz):** Ruff, mypy, pytest com **cobertura mínima de 90%** e compilação do pacote.
  - **Padrão de commits:** todo commit novo segue Conventional Commits.
- **Proteção da `main`:** exige PR e os três pipelines aprovados, inclusive para o administrador; sem push direto, force push ou exclusão. Não exige revisão aprovada, porque o projeto tem um mantenedor só.
- **Merge commit apenas:** squash e rebase ficam desativados. Os dois reescrevem os commits na `main` e fariam a `homologacao`, que é permanente, divergir dela a cada ciclo. A mensagem do merge usa o título do PR, que já segue o padrão.
- A `homologacao` também é protegida contra exclusão e force push, e não é apagada após o merge.

## Consequências
- Nada chega à `main` sem passar pelos pipelines. Os mínimos de cobertura podem subir, mas não descer sem uma decisão nova.
- Quando houver colaboradores, eles abrem PRs de branches próprias para a `homologacao`; os mesmos pipelines rodam no `pull_request`.
- O PR `homologacao → main` não dispara a CI de novo: os pipelines do push na `homologacao` rodam no mesmo commit e valem como verificação do PR. Disparar também no `pull_request` duplicaria a execução e, por o PR ser aberto pelo bot, ela ficaria parada esperando aprovação manual.
- Builds do app Electron por plataforma entram no pipeline quando `apps/desktop` existir (Fases 1 e 8).
- **Exceção à cobertura unitária:** a cena three.js (`packages/avatar/src/scene`) depende de WebGL e não roda em teste unitário. Ela fica fora do cálculo de cobertura e é verificada por comparação visual com o protótipo v6 (`packages/avatar/dev/capture.ts`, mesmo instante de animação nas duas versões) e, depois, por testes ponta a ponta. A lógica de animação fica fora da cena, em `packages/avatar/src/motion`, com cobertura normal. Nenhuma outra pasta entra na exceção sem um ADR.
