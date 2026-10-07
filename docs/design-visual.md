# Design visual aprovado

Referência oficial: `prototipos/kobi-v6.html` (abrir no navegador; arraste para girar). Esse protótipo foi aprovado como o padrão de qualidade e aparência do avatar. Mantenha formas, proporções, cores e materiais; o modelo definitivo (Blender) deve seguir esse resultado.

## Personagem

- Robozinho **sem pernas**, que **flutua** com leve oscilação vertical (sobe e desce suavemente) e leve balanço.
- **Cabeça** em bloco de cantos bem arredondados, mais larga que alta.
- **Display/visor** retangular de cantos arredondados, com moldura cinza ao redor.
- **Fone de ouvido**: haste sobre a cabeça e conchas nas laterais; anel colorido nas conchas acompanha a cor dos LEDs.
- **Antena** única no topo da haste, com bolinha de LED na cor dos LEDs.
- **Corpo em gota**, com junção (friso) no pescoço e um friso horizontal no corpo.
- **Bracinhos** arredondados e articulados nos ombros; os dois gesticulam (acenar, levar à cabeça, segurar a cabeça) sem atravessar o corpo nem a cabeça.
- **Cabeça articulada no pescoço**, independente do corpo (ver "Linguagem corporal").
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

### Cores do corpo (aprovadas em 2026-10-07, spec 0004)

Configuráveis e independentes da cor dos LEDs. Todas foscas e dessaturadas, como pintura fosca ou cerâmica, **nunca com a vivacidade dos LEDs**. Cada cor define quatro peças, mantendo o mesmo contraste entre elas:

| Cor | Casca | Frisos e moldura | Juntas | Fone |
|---|---|---|---|---|
| Cinza claro (padrão) | `#aeb3ba` | `#6a717b` | `#22252a` | `#23272e` |
| Chumbo | `#3b3e43` | `#1f2226` | `#0e0f11` | `#16181c` |
| Rosa | `#a8848d` | `#7a5a62` | `#2e2427` | `#2a2326` |
| Azul | `#7b8fa8` | `#53667d` | `#20262e` | `#1e232b` |
| Verde | `#859982` | `#5a6d58` | `#212923` | `#1f2521` |
| Marrom | `#8a7262` | `#5d4a3f` | `#241c18` | `#201915` |
| Âmbar | `#c4955a` | `#8f6a3c` | `#2c2217` | `#261d14` |

O visor continua fumê em todas. A tabela vive em `packages/avatar/src/scene/palette.ts`; uma cor nova entra como dado.

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

O display é o principal meio de interação e de expressão emocional do Kobi. As expressões precisam ser **bem visíveis**, **proporcionais ao display** e **numerosas**, para uma personalidade rica. A referência de ambição são robôs físicos de mesa com display no rosto que chegam a **cerca de 700 expressões**: o Kobi deve alcançar essa riqueza ou superá-la, combinando o display com a linguagem corporal.

Os olhos mudam de **forma, tamanho e posição** conforme o momento e a emoção, não só a "cara" pronta. Exemplos que precisam existir:
- **Olhos arregalados** (bem maiores) para chamar a atenção, surpresa ou susto.
- **Prestes a chorar:** olhos marejados, com o brilho de uma lágrima se acumulando na borda, que treme antes de cair.
- **Chorando:** lágrimas **saltando dos olhos para os lados**, em arcos, além das que escorrem.
- Olhos semicerrados de tédio, olhar para cima ao pensar, olhos em arco ao rir, piscadela, olhos que seguem o cursor.

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

Meta: ~40 expressões base × intensidades e variações + efeitos → **várias centenas de combinações** no display; somadas à linguagem corporal, **700 ou mais comportamentos distintos**, com personalidade coerente (a personalidade escolhe quais variações usar e com que frequência).

### Regras
- Tudo que aparece no display segue a cor configurada dos LEDs, sem halo nem "fantasma".
- Expressões definidas como **dados** (arquivos de descrição), não código: novas expressões entram sem alterar o motor.
- Uma galeria/editor de expressões para desenvolvimento e testes.

## Linguagem corporal

O corpo é o segundo canal de expressão, sempre **em sintonia com o display**: cada comportamento combina pose ou gesto do corpo, movimento da cabeça, expressão dos olhos e efeitos, como uma coisa só.

### Rig (esqueleto)
- **Cabeça articulada no pescoço:** olha para cima, para baixo, para os lados e até para trás, de forma **independente do corpo**, como um animal ou uma pessoa. O corpo acompanha com um leve deslocamento na mesma direção, mas fica claro que é a cabeça que se move sobre o pescoço.
- **Braços articulados nos ombros**, cada um com movimento próprio.
- **Corpo** que se inclina, se encolhe, "senta" (abaixa e se acomoda) e reage com pulinhos, sempre com a base como referência.

### Gestos e poses (exemplos do catálogo)
- **Braços em repouso:** os dois para baixo, relaxados.
- **Acenar** com o braço esquerdo, com o direito ou com os dois.
- **Pensando:** um braço levado à cabeça, olhar para cima, olhos pensativos.
- **Chamando a atenção:** acena com os dois braços, mais rápido, dando **pequenos pulinhos**, com os **olhos arregalados**.
- **Entediado:** meio que **se senta**, leva os **dois bracinhos à cabeça como quem a segura para não cair**, inclina a cabeça para baixo e solta de tempos em tempos um **suspiro profundo**: cabeça, corpo e braços sobem e descem devagar, típico de impaciência ou tédio, com olhos semicerrados no display.
- Comemorar, encolher de medo, tremer, murchar de tristeza, dar de ombros, inclinar a cabeça de lado com curiosidade, cochilar e despertar.

### Regras
- **Variedade:** parado, o Kobi **não repete o mesmo gesto o tempo todo** (o aceno contínuo do protótipo é só demonstração). Ele alterna poses e gestos com ritmo natural, evitando repetições seguidas.
- **Comportamentos como dados:** gestos e poses são descritos em arquivos (quadros-chave e curvas), como as expressões do display. Comportamento novo entra sem mudar o motor.
- **Camadas que se somam:** pose base (ocioso, sentado, entediado) + gesto (braços) + olhar (cabeça) + locomoção (giro, pêndulo, poeira) + flutuação, com transições suaves entre elas.
- A personalidade (`docs/personalidade.md`) decide quais comportamentos aparecem e com que frequência e amplitude (energia, mobilidade, humor...).
- Mesmas regras de fluidez: tudo calculado pelo tempo decorrido, sem custo perceptível, respeitando "reduzir movimento".

## Movimento e deslocamento (aprovado em 2026-10-07, spec 0004)

- **Voo flutuante** em qualquer direção: acelera e freia suavemente, com leve ondulação lateral.
- **Vira o corpo para onde vai** (de perfil nos lados, de frente na vertical) e volta à pose de 3/4 ao parar.
- **Inclinação em pêndulo** com a base fixa: cabeça à frente na arrancada, para trás na freada, oscilando amortecida.
- **Poeira de derrapagem** singela em arrancadas e freadas fortes.

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
