# Design visual aprovado

Referência oficial: `prototipos/kobi-v6.html` (abrir no navegador; arraste para girar). Esse protótipo foi aprovado como o padrão de qualidade e aparência do avatar. Mantenha formas, proporções, cores e materiais; o modelo definitivo (Blender) deve seguir esse resultado.

## Personagem

- Robozinho **sem pernas**, que **flutua** com leve oscilação vertical (sobe e desce suavemente) e leve balanço.
- **Cabeça** em bloco de cantos bem arredondados, mais larga que alta.
- **Display/visor** retangular de cantos arredondados, com moldura cinza ao redor.
- **Fone de ouvido**: haste sobre a cabeça e conchas nas laterais; anel colorido nas conchas acompanha a cor dos LEDs.
- **Antena** única no topo da haste, com bolinha de LED na cor dos LEDs.
- **Corpo em gota**, com junção (friso) no pescoço e um friso horizontal no corpo.
- **Bracinhos** arredondados; um deles pode acenar sem invadir a cabeça.
- **Símbolo do peito**: anel de LED grande e bem visível sobre base escura, com ponto central. É o alvo do duplo clique que abre o menu rápido.
- Design original, apenas inspirado em referências — não copiar imagens de bancos de imagens nem produtos existentes.

## Cores e materiais

| Elemento | Padrão | Observações |
|---|---|---|
| Corpo (modo claro) | Cinza claro `#aeb3ba` | Nunca branco estourado. |
| Corpo (modo chumbo) | `#3b3e43` | Bem puxado para o preto. |
| Frisos e moldura | `#6a717b` (claro) / `#1f2226` (chumbo) | Separam visualmente as partes. |
| Fone de ouvido | `#23272e` (claro) / `#16181c` (chumbo) | |
| Display | Fumê `#15171a` | Acetinado, sem reflexo forte. |
| LEDs (olhos, anel do peito, antena) | Azul fluorescente `#1e90ff` | Cor configurável. Opções testadas: verde `#00ff6a`, âmbar `#ff9f00`, rosa `#ff1fa0`. |

- **Materiais totalmente foscos**: alta rugosidade, sem verniz, sem brilho especular, sem aparência de plástico barato.
- **LEDs fluorescentes e nítidos**, desenhados na cor pura (sem correção de tom), **sem halo nem "fantasma"** de cor nas peças vizinhas.
- **Iluminação de estúdio**: grandes fontes difusas (tipo softbox), sombras suaves, transições graduais. Sem bloom, sem reflexos fortes.
- Microvariação sutil de superfície (textura de rugosidade/relevo).
- Sombra suave no "chão" que encolhe e clareia quando o Kobi sobe, reforçando a flutuação.

## Qualidade de imagem

- Renderização com **supersampling**: renderizar em resolução maior (2–3× a tela) fora da tela e reduzir com filtro de alta qualidade. Bordas sem serrilhado.
- No app final, considerar suavização temporal (para movimento) e oclusão ambiente em tempo real.
- Meta: aparência de render 3D premium de produto em estúdio.

## Expressões (display) — principal canal de personalidade

O display é o principal meio de interação e de expressão emocional do Kobi. As expressões precisam ser **bem visíveis**, **proporcionais ao display** e **numerosas**, para uma personalidade rica.

### Tamanho e nitidez
- Olhos ocupando cerca de **45–55% da altura do display** (maiores que no protótipo v6), centrados e com respiro nas bordas.
- Rosto desenhado por **shader de campos de distância (SDF)** no próprio visor: bordas perfeitamente nítidas em qualquer tamanho, cor pura dos LEDs, animação suave e custo mínimo de GPU.

### Sistema paramétrico (em vez de centenas de animações feitas à mão)
Cada expressão é uma combinação de camadas, o que gera centenas de variações a partir de poucas peças:
1. **Olhos:** forma (oval, arco feliz, arco triste, retângulo, linha, ponto, coração, estrela, X, espiral, "> <"), abertura, inclinação, pálpebras superior/inferior, posição da "pupila"/olhar, tamanho, assimetria.
2. **Boca (opcional):** pequena linha/sorriso de LED; durante a fala, sincronizada com o áudio.
3. **Efeitos:** lágrimas, gota de suor, "zZz", interrogação, exclamação, corações, brilhos, nuvem de raiva, lâmpada de ideia, notas musicais, "</>", barra de carregamento, onda de áudio, estática/glitch, ✓ e ✗.
4. **Intensidade** (leve → extrema) e **transições** interpoladas entre expressões.
5. **Corpo reforçando a emoção:** inclinar a cabeça, murchar, pular, tremer, girar, encolher.

Comportamentos vivos contínuos: piscar com ritmo natural, micro-movimentos dos olhos, **olhar seguindo o cursor do mouse** às vezes, reações rápidas a eventos.

### Catálogo inicial (cada uma com intensidades e variações)
- **Emoções:** feliz, muito feliz, rindo, carinho/amor, orgulho, empolgado, surpreso, curioso, pensativo, concentrado, confuso, em dúvida, tive uma ideia, entediado, sonolento, dormindo, cansado, triste, chorando, desapontado, emburrado/birra, teimoso, irritado, bravo, envergonhado, assustado, nervoso, aliviado, piscadela/maroto, sarcástico/zoeiro, comemorando, determinado.
- **Estados do sistema:** ouvindo, falando, pensando com IA, pesquisando, carregando, erro, sem conexão, Não Perturbe (olhos fechados + lua), Fantasminha, microfone mudo, modo econômico, em reunião.
- **Eventos de trabalho:** build/teste passou (✓), falhou (✗), commit feito, lembrete chegando, pausa sugerida.

Meta: ~40 expressões base × intensidades e variações + efeitos → **várias centenas de combinações**, com personalidade coerente (a personalidade escolhe quais variações usar e com que frequência).

### Regras
- Tudo que aparece no display segue a cor configurada dos LEDs, sem halo nem "fantasma".
- Expressões definidas como **dados** (arquivos de descrição), não código: novas expressões entram sem alterar o motor.
- Uma galeria/editor de expressões para desenvolvimento e testes.

## Interação com o mouse

- Arrastar move o Kobi (pela tela e entre monitores); um gesto distinto gira (rodinha ou botão direito).
- Física ao soltar: segue no embalo e desacelera flutuando.
- Duplo clique no símbolo do peito abre/fecha o menu rápido.

## Menu rápido (aprovado)

Painel escuro e fosco (`#1b1e23`, borda `#2e333b`, cantos 20 px) que sai do peito do Kobi, com uma pequena seta apontando para ele.

- **Cabeçalho:** nome "Kobi" e linha de status com bolinha colorida ("Ouvindo, modo voz", "Modo texto", "Não perturbe ativo", "Microfone mudo"); botão de fechar.
- **Não perturbe** (interruptor) → ao ligar, mostra durações: 30 min, 1 hora, Até amanhã.
- **Modo Fantasminha** (interruptor) — "Oculto em compartilhamento de tela".
- **Conversa:** seletor Voz | Texto.
- **Microfone:** Ativo/Mudo (interruptor).
- **Pausar iniciativa** (interruptor) — "Só fala quando chamado".
- **Todas as configurações** (botão).

Interruptores ativos e destaques usam a cor dos LEDs. Alvos de clique com pelo menos 44 px. Texto com bom contraste.

## Modo texto (aprovado)

- **Balão de fala** claro (`#f6f7f9`, texto `#1d2127`) acima da cabeça, com seta apontando para o display (a "boca").
- Falas aparecem letra por letra; antes, três pontinhos animados de "digitando".
- Pedido de permissão para pesquisa dentro do balão: botões "Pesquisar" (cor dos LEDs) e "Agora não".
- **Campo de texto** escuro e arredondado abaixo do robô, com botão de enviar na cor dos LEDs; Enter envia.
- Balão e campo acompanham o Kobi quando ele se move.
