# Decisões do projeto

Registro das decisões tomadas no planejamento, com o motivo de cada uma. Mudanças devem ser registradas aqui, com data e justificativa.

## Produto

| Decisão | Motivo |
|---|---|
| Projeto **open source e gratuito**, sem comercialização | A motivação é a experiência de criar. Se um dia houver versão comercial, será um projeto à parte. |
| Nome fixo **Kobi** (provisório até verificação final) | Nome fixo deixa a palavra de ativação leve e precisa e carrega a identidade do app. Pronúncia "Kôbi" (o fechado), igual em português e inglês. Descartados: Kodi e Codee (marcas de software existentes), Bobee (pronúncia ambígua, lembra "bobo"), Robie (descritivo demais), Martim (conflito com assistente de IA "Martin"; nome/sobrenome comum causa ativações falsas). |
| Palavra de ativação recomendada: **"Hey Kobi"** (a confirmar) | "Hey" e "ei" soam quase iguais; uma única frase atende pt, en, es e fr. Frase de 3–4 sílabas reduz ativações falsas. |
| Suporte a Windows, macOS e Linux (Wayland e X11) | Público de desenvolvedores usa os três. |

## Stack

| Decisão | Motivo |
|---|---|
| **TypeScript** como linguagem principal | Reaproveita o protótipo 3D em three.js; o Wellington domina Node/NestJS/React; extensão do GNOME também é JavaScript. |
| **Electron** (e não Tauri) | No Linux, o Tauri usa WebKitGTK, com desempenho de WebGL e suporte a transparência menos consistentes. O Electron garante o 3D fluido, ao custo de mais memória. |
| **three.js** para o avatar | Protótipo v6 aprovado já usa three.js. |
| **Python** no serviço de voz | Ecossistema de áudio mais maduro (openWakeWord, Whisper, Piper). Empacotado com Python embutido; o usuário não instala nada à parte. Pode migrar para ONNX no Node no futuro. |
| Java e Go descartados para o app | Ecossistemas fracos para janelas transparentes, 3D em tempo real e overlay. |
| Ferramentas e bibliotecas gratuitas/open source | Projeto sem custo. Preferir licenças permissivas; verificar licença de cada modelo e voz. |

## Overlay e plataformas

| Decisão | Motivo |
|---|---|
| Janela transparente, sempre no topo, com clique atravessando exceto nos pixels do avatar | Padrão dos "desktop pets"; não atrapalha o trabalho. |
| No GNOME (Wayland), uma **extensão auxiliar** posiciona e mantém a janela do Kobi no topo; a renderização 3D fica no app | Wayland não permite que apps comuns se posicionem ou fiquem no topo; renderizar 3D dentro da extensão seria inviável. Validar em protótipo. |
| Em KDE/wlroots, protocolo layer-shell; nos demais, XWayland como alternativa | Cada compositor Wayland tem regras próprias. |
| Fantasminha: Windows com exclusão oficial de captura; macOS com opção equivalente (testar por versão); Linux detecta compartilhamento e esconde o visual | Não existe forma padrão no Wayland de excluir uma janela da captura de tela inteira. |

## IA, memória e privacidade

| Decisão | Motivo |
|---|---|
| **Local-first**: regras, rotinas e memória local antes de IA | Menos custo, mais rapidez e privacidade. |
| Memória local em **Markdown legível + SQLite** (busca por palavras e por similaridade com modelo local pequeno) | Transparência: o usuário vê e edita o que o Kobi sabe. Enviar só memórias relevantes reduz tokens. |
| Provedores via **interface única** (API própria do usuário, Ollama, CLIs) | Flexibilidade e independência de fornecedor. |
| **Limites de uso** diários e mensais, com ciclo configurável | APIs são cobradas por token, separadamente das assinaturas. O app soma o uso informado nas respostas. |
| **Permissão** antes de pesquisar | O usuário controla gastos e o que é enviado. Níveis: sempre perguntar, pesquisar sozinho até um limite, nunca pesquisar. |
| CLIs (Claude Code, Codex, Antigravity/Gemini) como **provedor experimental**, ativado manualmente | O Kobi usa a CLI oficial já logada pelo usuário (modo não interativo, só ferramentas de pesquisa, pasta própria). Nunca implementa login nem toca em tokens: a Anthropic não permite que terceiros ofereçam login claude.ai sem aprovação. Regras de cada empresa mudam com frequência; confirmar termos antes de divulgar. |
| Login das CLIs feito pela própria CLI | Botão "Abrir para entrar" abre um terminal com a CLI oficial. |
| Diretórios de leitura configuráveis | Restringe o acesso do Kobi na máquina. |

## Voz e idiomas

| Decisão | Motivo |
|---|---|
| Voz como modo padrão; texto como alternativa | Interação mais natural; texto para ambientes silenciosos. |
| Apertar para falar **ou** escuta contínua com palavra de ativação | Escolha do usuário entre privacidade/CPU e conveniência. |
| **Configurações expostas como comandos** (consultar, definir, ajustar relativo, desfazer), acionáveis por voz/texto e pelos menus | Uma única fonte de verdade: cada configuração tem esquema tipado (tipo, faixa, valores permitidos). Reconhecimento local primeiro (frases comuns: "teimosia pra 15%", "olhos laranja", "não perturbe 2h"); IA com chamada de ferramentas só para frases criativas ("vestidinho azul"). Teimosia afeta comportamento, nunca a obediência a configurações. |
| **Configurações sensíveis só pelo menu** (chaves de API, diretórios, limites de gasto, provedores, integrações) | Segurança: frase mal entendida, outra pessoa perto do microfone ou conteúdo malicioso lido pela IA (injeção de prompt em páginas pesquisadas) não conseguem alterar o que importa, porque essas configurações nem existem como comando de voz/texto nem como ferramenta da IA. |
| **Latência mínima** na conversa: buffer de pré-gravação, transcrição em streaming, reação imediata com áudio pré-sintetizado, resposta em streaming frase a frase, interrupção | O computador tem muito mais recursos que um celular; a sensação de "parceiro presente" depende de nunca haver silêncio ou espera na conversa. |
| **Treino pessoal** da palavra de ativação (frase continua única: "Hey Kobi") | Modelo base genérico + ajuste com 3–5 gravações do usuário: calibração de limiar e verificador personalizado (openWakeWord "custom verifier"), treinados em segundos, localmente. Opcional: verificação de locutor ("voice match") para ignorar outras vozes. Amostras ficam só na máquina. |
| Idiomas: pt, en, es (fr desejável); modo automático ou fixo | Público amplo; modo fixo permite treinar idiomas. |
| Display como **principal canal de expressão**: rosto paramétrico por shader SDF, ~40 expressões base com intensidades, variações e efeitos (centenas de combinações), definidas como dados | Personalidade rica com custo baixo; nitidez máxima; novas expressões sem mexer no motor. Robôs físicos chegam a ~700 expressões; a abordagem paramétrica alcança essa riqueza sem animar tudo à mão. |
| Mesmo efeito leve de "voz robótica" sobre vozes de timbre parecido em cada idioma | Mantém a identidade sonora do Kobi entre idiomas. |
| Treino de inglês com correção de escrita e pronúncia (ativável) | Uso pessoal importante do Wellington. |

## Distribuição

| Decisão | Motivo |
|---|---|
| Instaladores: `.exe` (Windows), `.dmg` (macOS), Flatpak/Flathub e AppImage (Linux) | Instalação no padrão de cada sistema. |
| Sem assinatura de código paga | Projeto gratuito; documentar os avisos de primeira execução no Windows e macOS. |
| Extensão GNOME publicada no site oficial de extensões | Ativação com um clique; o Kobi detecta o GNOME e indica o link. |
| Builds de Windows e macOS via GitHub Actions | Não há Mac disponível; CI gratuita para repositórios públicos. |

## Pendências

- Confirmar pronúncia ("Kôbi") e frase de ativação ("Hey Kobi").
- Verificar nome Kobi: apps/projetos existentes e domínio.
- Escolher a licença do projeto (MIT/Apache 2.0 ou GPL) antes de aceitar a primeira contribuição externa.
- Confirmar termos de uso das CLIs de IA antes de divulgar a integração.
