# Engenharia de software do Kobi

Regras para manter o projeto fácil de modificar, estender e evoluir. Valem para todo código, em TypeScript e Python.

## 1. Princípios

- **Clean Code:** nomes que revelam intenção, funções pequenas com uma responsabilidade, sem comentários que expliquem o óbvio, sem código morto.
- **SOLID:** em especial *Open/Closed* (novos provedores, plataformas, skills e idiomas entram por extensão, sem alterar o núcleo) e *Dependency Inversion* (o núcleo depende de interfaces, nunca de implementações).
- **Baixo acoplamento, alta coesão:** módulos conversam por interfaces e eventos, não por detalhes internos.
- **Pragmatismo (YAGNI):** abstração só quando há mais de uma implementação real ou prevista no roadmap. Não criar camadas vazias.

## 2. Clean Architecture (hexagonal)

Quatro camadas, com dependências sempre apontando para dentro:

| Camada | Contém | Pode depender de |
|---|---|---|
| **Domínio** | Entidades, value objects, regras de negócio, eventos de domínio | nada externo |
| **Aplicação** | Casos de uso, portas (interfaces), orquestração | domínio |
| **Infraestrutura** | Adaptadores: provedores de IA, SQLite, arquivos, voz, Google Agenda, plataformas | aplicação e domínio |
| **Apresentação** | Electron (main/renderer), three.js, menus, balão, configurações | aplicação |

- O domínio não conhece Electron, three.js, Node APIs, Python nem provedores.
- **Composition root** único por processo: é o único lugar que instancia adaptadores e os injeta nos casos de uso. Injeção de dependência manual via construtor (sem framework de DI, a menos que se prove necessário).
- A regra de dependência é verificada automaticamente no lint (ex.: `eslint-plugin-boundaries` ou `dependency-cruiser`).

## 3. DDD

### Contextos delimitados (bounded contexts)

| Contexto | Responsabilidade |
|---|---|
| **Presença** | Posição, movimento, flutuação, monitores, estados visuais do avatar |
| **Conversa** | Mensagens, modos voz/texto, idioma da conversa, roteamento de respostas |
| **Personalidade** | Traços, banco de falas, reações (teimosia, emoções), iniciativa |
| **Memória** | Fatos, preferências, padrões, consolidação, busca |
| **Inteligência** | Provedores, roteador local-first, permissões de pesquisa, orçamento de uso |
| **Voz** | Ativação, transcrição, síntese, pronúncia (serviço Python) |
| **Integrações** | Agenda, git, histórico do Claude Code, diretórios permitidos |
| **Treino de idiomas** | Correções, leitura guiada, erros recorrentes, vocabulário |
| **Preferências** | Configurações do usuário e modos (Não Perturbe, Fantasminha) |

- Cada contexto tem sua linguagem ubíqua e seu próprio modelo. Contextos se comunicam por **eventos de domínio** ou por interfaces da camada de aplicação, nunca acessando o interior um do outro.
- Táticos: **entidades** com identidade (ex.: `Conversation`, `MemoryFact`), **value objects** imutáveis e validados na criação (ex.: `LanguageCode`, `LedColor`, `TokenBudget`, `AllowedPath`), **agregados** com invariantes protegidas (ex.: `UsageBudget` garante que o limite nunca é ultrapassado), **repositórios** como portas.
- Eventos de domínio no passado: `UserSpoke`, `ResponseReady`, `BudgetExceeded`, `DoNotDisturbEnabled`, `ScreenShareStarted`, `BuildFailed`.

## 4. Padrões de projeto recomendados

| Padrão | Onde | Por quê |
|---|---|---|
| **Ports & Adapters** | Todas as fronteiras externas | Trocar tecnologia sem tocar no núcleo |
| **Strategy** | Provedores de IA, estratégia de overlay por plataforma, estilo de correção | Variações intercambiáveis por configuração |
| **Adapter** | APIs Claude/OpenAI/Gemini, Ollama, CLIs, Whisper/Piper | Normalizar interfaces externas para as portas |
| **Registry + Factory** | Registro de provedores, skills, idiomas, perfis de CLI | Extensão por plugin: adicionar sem alterar o existente |
| **Chain of Responsibility** | Roteador local-first (skill local → memória → modelo local → nuvem) | Cada elo decide se resolve ou passa adiante |
| **Decorator** | Envolver provedores com orçamento, permissão, cache, logs, retentativas | Comportamentos transversais sem poluir os adaptadores |
| **Command** | Skills locais e comandos do usuário ("vai pro canto", "não perturbe 1h") | Comandos como objetos testáveis, enfileiráveis e reversíveis |
| **State / máquina de estados** | Comportamento do Kobi (ocioso, passeando, ouvindo, falando, emburrado) e modos | Transições explícitas e testáveis; evita `if` espalhado |
| **Observer / barramento de eventos** | Eventos de domínio entre contextos e entre processos | Desacoplamento total entre emissores e reações |
| **Repository** | Memória, configurações, histórico de uso | Persistência isolada do domínio |
| **Specification** | Regras de "posso interromper agora?", "posso ler este caminho?" | Regras combináveis e testáveis |
| **Facade** | API do serviço de voz e da extensão GNOME vista pelo app | Esconde protocolo e processos externos |
| **Anti-Corruption Layer** | Leitura do histórico do Claude Code e saídas das CLIs | Formatos de terceiros não vazam para o domínio |

## 5. Estrutura do repositório (monorepo)

```
kobi/
  apps/
    desktop/                  Electron: main, renderer, composition roots
  packages/
    domain/                   entidades, value objects, eventos (TS puro)
    application/              casos de uso e portas
    infrastructure/           adaptadores (IA, SQLite, arquivos, agenda...)
    avatar/                   cena three.js do Kobi (a partir do protótipo v6)
    i18n/                     traduções
  services/
    voice/                    serviço Python (mesmas camadas: domain/app/infra)
  extensions/
    gnome/                    extensão GJS (GPL)
  docs/
    adr/                      registros de decisões arquiteturais
    specs/                    specs por funcionalidade
  prototipos/
```

- pnpm workspaces para os pacotes TS; cada pacote com fronteiras explícitas de importação, verificadas pelo dependency-cruiser (ADR 0002). Cada pasta nasce na fase que a usa.
- Contrato entre app e serviço de voz versionado (mensagens JSON com schema).

## 6. Testes

- **TDD** em domínio e aplicação: testes unitários rápidos, sem I/O (Vitest / pytest).
- **Testes de contrato** para cada adaptador: todo provedor de IA passa na mesma suíte da porta `LlmProvider`.
- **Testes de integração** com SQLite real e arquivos temporários.
- **Testes ponta a ponta** do app Electron (Playwright) para fluxos principais: menu rápido, modo texto, permissões.
- Fakes e stubs implementam as portas; nada de mocks acoplados a detalhes internos.

## 7. Qualidade e fluxo

- TypeScript em modo `strict`; ESLint + Prettier; Ruff + mypy no Python.
- Commits no padrão Conventional Commits; versionamento semântico.
- CI no GitHub Actions: lint, verificação de fronteiras, testes e build por plataforma.
- **ADRs** em `docs/adr/` para cada decisão arquitetural nova (contexto, decisão, consequências).
- Funcionalidades experimentais (ex.: CLIs de IA) atrás de *feature flags*.
- Erros como valores tipados no domínio (`Result`/exceções de domínio), tratados nas bordas com mensagens amigáveis.
