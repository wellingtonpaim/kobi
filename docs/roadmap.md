# Roadmap

Fases sugeridas. Cada fase começa com specs em `docs/specs/` e termina com algo usável.

## Fase 0 — Preparação
- Repositório no GitHub, estrutura de pastas, lint/format, testes, CI básica.
- Ambiente: VS Code (RPM), Node LTS, Python 3 + uv, ferramentas de compilação, portaudio-devel.

## Fase 1 — Protótipos de risco (spikes)
- Kobi v6 numa janela Electron transparente, sempre no topo, com click-through fora do avatar, no GNOME 50 Wayland.
- Extensão GNOME mínima para posicionar e manter a janela no topo; comparar com XWayland.
- Movimento e arraste entre os três monitores.
- Palavra de ativação "Hey Kobi" com openWakeWord (treino no Colab ou local).
- Resultado: decisão final sobre a estratégia de overlay no Linux.

## Fase 2 — MVP
- Kobi flutuando e passeando pelas telas; arrastar e girar com o mouse.
- Menu rápido (duplo clique no peito) e bandeja do sistema.
- Modo texto com balão e campo, conversando com um provedor (chave de API ou Ollama).
- Não Perturbe manual, configurações básicas, memória local inicial.

## Fase 3 — Voz
- Serviço Python: apertar para falar, transcrição (Whisper), fala (Piper/Kokoro) com efeito de voz do Kobi.
- Palavra de ativação; seleção de microfone e saída de som; cancelamento de eco.
- Treino pessoal da ativação: gravação guiada de 3–5 amostras + ruído ambiente, calibração de limiar, verificador personalizado; depois, verificação de locutor opcional.
- Idiomas pt/en/es (fr desejável), modo automático e fixo.

## Fase 4 — Cérebro
- Personalidade configurável conforme `docs/personalidade.md` (resolvedor de níveis, amortecedores de contexto, personalidades prontas), banco de falas local por idioma.
- Agendador de iniciativa com gatilhos; detecção de momentos para não interromper.
- Permissão de pesquisa, limites de uso, múltiplos provedores, CLIs experimentais.

## Fase 5 — Memória e contexto
- Memória Markdown + SQLite com busca local; consolidação em lote.
- Skills locais (comandos, lembretes, agenda).
- Integrações: Google Agenda, histórico do Claude Code, repositórios git, diretórios permitidos.

## Fase 6 — Expressões e comportamento
- Motor de expressões do display (shader SDF, camadas de olhos/boca/efeitos, transições) e catálogo inicial de ~40 expressões com intensidades; galeria de expressões. Expressões básicas (feliz, ouvindo, falando, pensando) já entram no MVP.
- Teimosia e reações; física ao soltar; saída física sempre obedece.
- Modo Fantasminha em cada plataforma; Não Perturbe automático.

## Fase 7 — Treino de idiomas
- Correção de escrita configurável.
- Leitura guiada com avaliação de pronúncia; depois, análise por fonemas.
- Erros recorrentes e vocabulário com revisão espaçada.

## Fase 8 — Multiplataforma e distribuição
- Builds Windows e macOS no GitHub Actions; testes em VM Windows e sessão X11.
- Instaladores, assistente de primeira execução, atualização automática (Windows/Linux).
- Flathub e publicação da extensão GNOME.

## Fase 9 — Acabamento visual
- Modelo definitivo no Blender, seguindo o protótipo v6.
- Suavização temporal, oclusão ambiente, polimento de animações.
