# Kobi

Kobi é um mascote/companheiro de IA para desenvolvedores: um robozinho 3D que flutua por cima de todas as janelas, anda entre os monitores, conversa por voz ou texto, tem personalidade configurável e ajuda no dia a dia de trabalho.

Projeto **open source e gratuito**.

> Status: planejamento concluído, iniciando a Fase 0 (preparação). Veja o [roadmap](docs/roadmap.md).

## Documentação

- [Visão](docs/visao.md): o que é o Kobi e as funcionalidades planejadas
- [Decisões](docs/decisoes.md): decisões tomadas e seus motivos
- [Design visual](docs/design-visual.md): avatar, menu rápido e modo texto
- [Personalidade](docs/personalidade.md): traços e comportamento
- [Arquitetura](docs/arquitetura.md): módulos e comunicação
- [Engenharia](docs/engenharia.md): DDD, camadas, testes e estrutura do repositório
- [Performance](docs/performance.md): prioridades e orçamento de desempenho
- [Roadmap](docs/roadmap.md): fases do projeto
- [ADRs](docs/adr/README.md): registros de decisões arquiteturais

O protótipo 3D de referência está em [`prototipos/kobi-v6.html`](prototipos/kobi-v6.html) (abra direto no navegador).

## Stack

TypeScript + Electron, three.js, serviço de voz em Python, extensão GNOME em GJS, memória local em Markdown + SQLite.

## Desenvolvimento

Requisitos: Node 24+, pnpm, Python 3.14+ e uv.

```bash
pnpm install       # dependências do monorepo TypeScript
pnpm check         # formatação, lint, tipos, fronteiras entre camadas e testes
pnpm test:watch    # testes em modo contínuo
```

O serviço de voz tem os próprios comandos em [`services/voice`](services/voice/README.md). As ferramentas e o motivo de cada escolha estão no [ADR 0002](docs/adr/0002-monorepo-e-ferramentas.md).

## Licença

[MIT](LICENSE). A extensão GNOME é distribuída separadamente sob GPL-2.0-or-later ([ADR 0001](docs/adr/0001-licenca-mit.md)).
