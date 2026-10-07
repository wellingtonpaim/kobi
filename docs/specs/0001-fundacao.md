# 0001 — Fundação do repositório

- Fase: 0
- Status: implementada

## Objetivo
Deixar o repositório pronto para desenvolver com segurança: estrutura do monorepo, qualidade automática e os primeiros tipos compartilhados do domínio.

## Comportamento

### Qualidade
- `pnpm check` roda formatação, lint, tipos, fronteiras entre camadas e testes. A CI roda o mesmo, e também Ruff, mypy e pytest no serviço de voz.
- Um import proibido (ex.: o domínio importando `node:fs` ou um pacote npm) faz a verificação de fronteiras falhar.

### `Result`
- Erros esperados do domínio são retornados como valores: `{ ok: true, value }` ou `{ ok: false, error }`.

### `LanguageCode`
Idioma em que o Kobi conversa (value object do núcleo compartilhado).
- Idiomas suportados: `pt`, `en`, `es`, `fr`.
- Dado uma tag regional ou um locale do sistema (`pt-BR`, `en_US`, `es-419`, `fr_CA.UTF-8`), guarda só o idioma base.
- Ignora maiúsculas e espaços nas pontas.
- Dado um idioma não suportado, vazio ou inválido, retorna o erro `unsupported-language` com a entrada original.
- Dois códigos do mesmo idioma são iguais.

## Fora do escopo
- Pacotes de apresentação, infraestrutura, avatar e i18n (entram nas fases que os usam).
- Camadas do serviço de voz (Fase 3) e extensão GNOME (Fase 1).
- Hooks de commit; o padrão Conventional Commits é seguido por convenção.

## Critérios de aceite
- [x] `pnpm check` passa localmente.
- [x] A CI passa nos dois jobs.
- [x] Testes de `Result` e `LanguageCode` cobrem todos os cenários acima.
- [x] Violação proposital de fronteira é detectada.

## Desempenho
Não se aplica.
