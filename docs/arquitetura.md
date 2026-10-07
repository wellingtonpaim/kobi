# Arquitetura

Proposta inicial, a ser refinada nas specs de cada fase. Segue Clean Architecture: o domínio não conhece Electron, three.js, Python nem provedores; tudo isso fica em adaptadores.

## Visão geral dos módulos

```
┌──────────────────────────── App Electron (TypeScript) ────────────────────────────┐
│                                                                                    │
│  Palco (main process)          Personagem (renderer)          Interface (renderer) │
│  - janela overlay transparente - avatar three.js              - menu rápido        │
│  - click-through por região    - animações, flutuação         - balão / campo texto│
│  - multi-monitor, arrastar     - expressões no display        - configurações      │
│  - bandeja, atalhos            - supersampling                - i18n               │
│                                                                                    │
│  Cérebro (utility process / main) — domínio + casos de uso                         │
│  - personalidade        - agendador de iniciativa     - orçamento (limites de uso) │
│  - permissões           - roteador local-first        - treino de idiomas          │
│  - memória (portas)     - skills locais (comandos)    - modos (Não Perturbe etc.)  │
│                                                                                    │
│  Adaptadores                                                                       │
│  - LLM: API Claude / OpenAI / Gemini, Ollama, CLIs (Claude Code, Codex, agy)       │
│  - Memória: arquivos Markdown + SQLite (FTS5 + vetores locais)                     │
│  - Contexto: git, ~/.claude/projects, diretórios permitidos                        │
│  - Agenda: Google Calendar                                                         │
│  - Voz: cliente do serviço local                                                   │
│  - Plataforma: Windows / macOS / X11 / Wayland (layer-shell, extensão GNOME)       │
└───────────────┬─────────────────────────────────────────────┬──────────────────────┘
                │ IPC local (WebSocket ou stdio, JSON)        │ D-Bus (só GNOME)
┌───────────────┴──────────────┐                  ┌───────────┴──────────────┐
│ Serviço de voz (Python)      │                  │ Extensão GNOME (GJS)     │
│ - palavra de ativação        │                  │ - mantém janela no topo  │
│ - transcrição (Whisper)      │                  │ - posiciona entre        │
│ - detecção de idioma         │                  │   monitores              │
│ - fala (Piper/Kokoro)        │                  │ - detecta compartilha-   │
│ - efeito de voz do Kobi      │                  │   mento de tela          │
│ - avaliação de pronúncia     │                  │                          │
└──────────────────────────────┘                  └──────────────────────────┘
```

## Princípios de implementação

- **Renderização nunca bloqueia:** o loop do three.js roda independente; IA, voz e disco são assíncronos com streaming.
- **Roteador local-first:** cada pedido do usuário passa por: (1) skills/comandos locais e memória → (2) modelo local, se configurado → (3) IA na nuvem, respeitando permissão e orçamento.
- **Porta `LlmProvider`:** interface única (`complete`, `stream`, `search`, uso de tokens/custo). Um adaptador por provedor. CLIs entram por um adaptador genérico com perfis por ferramenta (comando, flags de só-pesquisa, parser da saída).
- **Porta `MemoryStore`:** grava e busca fatos; implementação em Markdown + SQLite. Consolidação de conversas em fatos feita em lote (fim do dia) ou por modelo local.
- **Porta `ContextSource`:** fontes de contexto de trabalho, sempre filtradas pela lista de diretórios permitidos.
- **Registro de configurações como comandos:** cada configuração é declarada uma vez (nome, tipo, faixa ou valores, nível de sensibilidade, rótulos por idioma). Desse registro derivam: os menus, os comandos locais de voz/texto, as ferramentas oferecidas à IA (function calling) e o histórico com desfazer (padrão Command). Nova configuração = nova entrada no registro, sem tocar em menus nem no parser.
  - Cada entrada tem um **canal permitido**: `conversation` (voz, texto e menu) ou `menu-only`. Entradas `menu-only` (chaves de API, diretórios permitidos, limites de gasto, provedores, integrações) **não geram comandos de voz/texto nem ferramentas para a IA** — a restrição é estrutural, não uma checagem posterior. Pelo canal de conversa, o máximo permitido é abrir a janela de configurações na seção correspondente.
- **Acesso a arquivos:** um único serviço resolve o caminho real e confere a lista permitida antes de qualquer leitura.
- **Orçamento:** soma o uso reportado por cada resposta (tokens/custo), aplica travas diária e mensal com ciclo configurável.
- **Credenciais:** chaves de API do usuário guardadas no cofre de senhas do sistema (Keychain, Credential Manager, Secret Service). Nunca credenciais de CLIs de terceiros.

## Dados locais (proposta)

```
~/.local/share/kobi/          (equivalente em cada sistema)
  memory/
    perfil.md
    rotinas.md
    projetos/<nome>.md
    idiomas/erros.md
    idiomas/vocabulario.md
  kobi.db                     (índice SQLite, histórico de uso, orçamento)
  config.json                 (configurações, sem segredos)
```

## Riscos técnicos a validar primeiro

1. Overlay 3D transparente com click-through por região no GNOME 50 (Wayland), com três monitores — via extensão auxiliar e/ou XWayland.
2. Arrastar a janela do Kobi entre monitores no Wayland.
3. Palavra de ativação "Hey Kobi" treinada com openWakeWord (precisão, falsos positivos, CPU).
4. Modo Fantasminha em cada sistema.
5. Foco de teclado no campo de texto do overlay (principalmente no Wayland).
