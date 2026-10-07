# Kobi — instruções para o Claude Code

Kobi é um mascote/companheiro de IA para desenvolvedores: um robozinho 3D que flutua por cima de todas as janelas, anda entre os monitores, conversa por voz ou texto, tem personalidade configurável e ajuda no dia a dia de trabalho. Projeto **open source e gratuito**, criado pelo Wellington.

Antes de qualquer tarefa, leia os documentos em `docs/`:

- `docs/visao.md` — o que é o Kobi e todas as funcionalidades planejadas
- `docs/decisoes.md` — decisões tomadas e seus motivos (não reabrir sem pedido explícito)
- `docs/design-visual.md` — aparência aprovada do avatar, menu rápido e modo texto
- `docs/personalidade.md` — os 13 traços de personalidade, comportamento em cada nível (0–100%) e regras globais
- `docs/arquitetura.md` — módulos, responsabilidades e comunicação
- `docs/roadmap.md` — fases do projeto; trabalhe na fase indicada pelo Wellington
- `docs/performance.md` — **prioridades e orçamento de desempenho** (qualidade e fluidez acima de economia de memória)
- `docs/engenharia.md` — **regras de engenharia obrigatórias**: DDD, camadas, padrões de projeto, testes e estrutura do repositório

O protótipo 3D aprovado está em `prototipos/kobi-v6.html`. Ele é a **referência oficial** de modelo, materiais, iluminação e qualidade de renderização. Ao implementar o avatar no app, reaproveite esse código em vez de recriar do zero, preservando formas, proporções e cores.

## Stack

- **App:** TypeScript + Electron
- **Avatar 3D:** three.js (renderização em tempo real, com supersampling)
- **Serviço de voz:** Python, processo local separado (palavra de ativação, transcrição, fala)
- **Extensão GNOME (auxiliar):** JavaScript (GJS), licença GPL, separada do app
- **Memória local:** arquivos Markdown legíveis + SQLite como índice

## Princípios inegociáveis

1. **Local-first:** resolver o máximo possível localmente (regras, memória, rotinas prontas). IA na nuvem só quando necessário, respeitando limites de uso e permissão do usuário.
2. **Privacidade:** o Kobi só lê diretórios explicitamente permitidos (validar caminho real, bloquear `../` e links simbólicos). Nada é enviado a uma IA sem o usuário saber.
3. **Nunca lidar com credenciais de terceiros:** integrações com Claude Code, Codex e afins usam a CLI oficial já instalada e logada pelo usuário. O Kobi nunca implementa login em contas claude.ai, ChatGPT ou Google, nem lê ou guarda tokens dessas ferramentas.
4. **Experiência em primeiro lugar:** qualidade de imagem máxima, movimentos a 60 fps e fala/escuta sem travamentos. Memória pode ser usada (até ~1 GB) para ganhar qualidade e velocidade; CPU/GPU contínuos não, para nunca atrapalhar o trabalho do usuário. A animação nunca espera IA, voz ou disco. Siga `docs/performance.md` e não introduza regressões.
5. **Agnóstico de provedor:** toda IA passa por uma interface única (porta) com adaptadores (API Claude/OpenAI/Gemini, Ollama, CLIs).

## Como trabalhar neste projeto

- Siga `docs/engenharia.md` em todo código: Clean Code, Clean Architecture (hexagonal), SOLID, DDD e padrões de projeto, com baixo acoplamento e foco em facilidade de evolução.
- A regra de dependência é inviolável: domínio não importa nada de fora; aplicação só conhece o domínio e portas; infraestrutura e apresentação ficam nas bordas.
- TDD no domínio e na aplicação. Não aceitar código novo sem testes.
- Decisões arquiteturais novas viram um ADR em `docs/adr/`.
- Pragmatismo: aplique os padrões onde trazem flexibilidade real; evite camadas e abstrações sem uso (YAGNI).
- Spec-Driven Development: para cada funcionalidade, uma spec em `docs/specs/` antes do código.
- Git: commitar sempre na branch `homologacao` (nunca direto na `main`), em Conventional Commits e sem linhas de coautoria. O push abre um PR automático para a `main`, que só aceita merge com os pipelines aprovados (ADR 0003). Rode `pnpm check` antes de commitar.
- Código, nomes de arquivos e identificadores em inglês; documentação e conversa em português (pt-BR).
- Interface do app com i18n (pt, en, es; fr desejável) — nunca texto fixo no código.
- Dependências: preferir licenças permissivas (MIT, Apache 2.0, BSD). Verificar a licença de cada modelo/voz usado.
- Ambiente principal de desenvolvimento: Fedora 44, GNOME 50 (Wayland puro), três monitores. Testar overlay e multi-monitor nesse ambiente primeiro.
- **Esse ambiente é referência de teste, não o alvo.** O Kobi é distribuído para qualquer pessoa: 1 a N monitores em qualquer disposição, escalas e taxas de atualização variadas, hotplug, Windows, macOS e várias distros. Nenhuma regra pode supor uma configuração específica; o que é de plataforma fica atrás de portas, e regras de geometria e afins ficam no domínio, testadas com vários cenários.
