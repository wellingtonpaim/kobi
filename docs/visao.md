# Visão do Kobi

## O que é

O Kobi é um companheiro de trabalho para desenvolvedores, em forma de um robozinho 3D que flutua sobre a tela, por cima de qualquer janela, e circula livremente entre todos os monitores. Ele conversa por voz ou texto, tem personalidade própria e configurável, toma iniciativa para puxar assunto, ajuda com perguntas e pesquisas, lembra compromissos e cria uma relação afetiva com o usuário — como um bichinho de estimação simulado que também é parceiro de trabalho.

É um projeto open source, de uso gratuito, feito pela experiência de criar.

## Plataformas

Windows, macOS e Linux (Wayland e X11), com instalação simples em cada sistema.

## Funcionalidades

### Presença na tela
- Avatar 3D em tempo real, flutuando com leve oscilação vertical, sobreposto a todas as janelas.
- Circula por todas as telas, sem limite de eixo, em configurações com vários monitores.
- Tamanho na tela configurável.
- O clique atravessa o Kobi, exceto nas áreas interativas do próprio avatar.
- Interação pelo mouse: arrastar o Kobi pela tela e entre monitores; girá-lo para vê-lo de outros ângulos.

### Conversa
- Modo **voz** (padrão): o Kobi fala e escuta. Microfone e saída de áudio configuráveis.
  - Escuta por **apertar para falar** (botão no avatar) ou **escuta contínua** com palavra de ativação ("Hey Kobi").
  - **Reação instantânea:** o Kobi mostra que está ouvindo imediatamente após "Hey Kobi", sem perder palavras ditas logo em seguida.
  - **Sem silêncio:** ao terminar de falar, o usuário recebe uma reação imediata; se o Kobi precisar buscar algo (IA ou memória), ele vai conversando enquanto busca e começa a resposta assim que a primeira frase estiver pronta. Pode ser interrompido a qualquer momento.
  - **Treino pessoal da ativação:** o usuário repete "Hey Kobi" algumas vezes (como no "Ok Google") e o Kobi se ajusta à voz e ao sotaque dele. Opcionalmente, passa a responder só à voz do dono.
- Modo **texto**: as falas do Kobi aparecem num balão acima da cabeça; o usuário escreve num campo abaixo do robô.
- Alternância voz/texto pelo menu rápido.

### Idiomas
- Português, Inglês e Espanhol (Francês desejável) — vozes e interface.
- Idioma da conversa **automático** (detecta o idioma falado/escrito) ou **fixo**.
- Interface com idioma próprio, independente da conversa.

### Personalidade e comportamento
- 13 traços configuráveis de 0 a 100% (teimosia, humor, zoeira, energia, ritmo, mobilidade, iniciativa, tagarelice, curiosidade, incentivo, franqueza, apego, profundidade), com comportamento definido em `docs/personalidade.md`, e personalidades prontas como ponto de partida.
- Iniciativa configurável: frequência de interações por hora e gatilhos (ociosidade, build falhou, commit, reunião próxima).
- Exemplo de teimosia: em 50%, depois de pedido para se esconder ou sair da frente, o Kobi volta a aparecer algumas vezes (de forma cômica) antes de obedecer de vez.
- Comandos de movimento ("sai da frente", "vai pro canto"): conforme a teimosia, pode teimar uma ou duas vezes de forma cômica, mas obedece a um pedido firme, podendo demonstrar desapontamento ou chorar (lágrimas no display).
- Expressões de emoção no display de LEDs.
- Uma saída física sempre obedece, independente da personalidade (arrastar o Kobi ou atalho de teclado).

### Modos especiais
- **Não Perturbe:** silencia falas e iniciativa; manual (com duração: 30 min, 1 h, até amanhã) ou automático (reunião na agenda, app em tela cheia, modo foco do sistema).
- **Fantasminha:** o Kobi continua visível e audível para o usuário, mas fica oculto para quem vê o compartilhamento de tela.
- **Pausar iniciativa:** só fala quando chamado.

### Inteligência
- Local-first: regras, memória local e rotinas prontas resolvem o máximo possível sem IA.
- Provedores de IA agnósticos: chave de API do próprio usuário (Claude, OpenAI, Gemini), modelos locais (Ollama) e, como opção experimental, CLIs oficiais já instaladas e logadas (Claude Code, Codex, Antigravity/Gemini).
- Pesquisa com permissão: quando não tem contexto, o Kobi pede autorização antes de pesquisar com IA.
- Limites de uso: trava diária e mensal, com dia de início do ciclo mensal configurável.

### Memória e contexto
- Memória local em arquivos Markdown legíveis e editáveis pelo usuário (inspirada no CLAUDE.md e nas skills do Claude Code), indexada em SQLite.
- Contexto de trabalho a partir de fontes locais permitidas: repositórios git, histórico de sessões do Claude Code em `~/.claude/projects/`, diretórios configurados.
- Google Agenda para lembrar compromissos.
- Diretórios que o Kobi pode ler são configuráveis.

### Treino de idiomas (foco inicial: inglês)
- Conversa com idioma fixo para praticar.
- Correção de escrita (ativável): a cada mensagem, só erros importantes, ou resumo ao fim.
- Correção de pronúncia: modo de leitura guiada (comparação com o texto esperado); evolução futura com análise por fonemas.
- Registro local de erros recorrentes e vocabulário, com revisão espaçada.

### Configurações
- **Menu rápido** (duplo clique no símbolo do peito): Não Perturbe, Fantasminha, voz/texto, microfone, pausar iniciativa e acesso a "Todas as configurações".
- **Janela de configurações completas:** aparência, personalidade, iniciativa, voz e áudio, idioma, IA e limites, privacidade e acesso, integrações.
- Ícone na bandeja do sistema e atalho de teclado que abrem o mesmo menu.
- **Configurar conversando** (voz ou texto), para praticamente todas as configurações:
  - Consultar: "Kobi, qual o nível da sua teimosia?" → "Tá em 50%."
  - Ajustar valores absolutos ou relativos: "baixa pra 15%", "fica um pouco menos zoeiro".
  - Aparência: "não gostei da sua roupa, bota um vestidinho azul" → corpo azul; "muda seus olhos pra laranja" → LEDs laranja.
  - Modos com duração: "vou entrar em reunião, não me perturba pelas próximas 2h" → Não Perturbe por 2 horas.
  - Desfazer: "volta como estava".
  - O Kobi responde no tom da personalidade (pode reclamar de brincadeira), mas **sempre aplica** a mudança.
  - **Configurações técnicas e sensíveis** (chaves de API, diretórios permitidos, limites de gasto, provedores e integrações) **só podem ser alteradas pelo menu de configurações**, nunca por voz ou texto. Se o usuário pedir, o Kobi explica que isso é só pelo menu e oferece abrir a janela já na seção certa. Ele nunca fala nem exibe o conteúdo de chaves (apenas "configurada" / "não configurada").
