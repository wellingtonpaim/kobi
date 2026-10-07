# 0004 — Cores do corpo e movimento expressivo

- Fase: 1 (avatar e base de movimento, junto do spike de overlay) e 2 (passeio autônomo usa o que nasce aqui)
- Status: implementada

## Objetivo
Dar ao Kobi mais personalidade visual: o usuário escolhe a cor do corpo entre várias opções, e o Kobi se desloca pela tela como algo vivo que flutua, vira o corpo para onde vai e se inclina como um pêndulo, em vez de deslizar rígido de um ponto a outro.

## Cores do corpo

### Comportamento
- Opções: **cinza claro** e **chumbo** (já aprovadas), **rosa**, **azul**, **verde**, **marrom** e **âmbar**.
- Todas mantêm a aparência aprovada em `docs/design-visual.md`: **materiais totalmente foscos**, microtextura de superfície, sem brilho especular, sem aspecto de plástico barato. As cores do corpo são **dessaturadas e realistas** (tons de pintura fosca ou cerâmica), nunca com a vivacidade das cores dos LEDs.
- Cada cor define as quatro peças do corpo, para manter o contraste entre elas como no cinza claro e no chumbo: **casca** (cabeça, corpo e braços), **frisos e moldura**, **juntas** (friso do pescoço e do corpo) e **fone de ouvido**.
- A cor do corpo e a cor dos LEDs são independentes: qualquer combinação é válida.
- O visor continua fumê em todas as cores.
- As opções são **dados** (uma tabela de cores), não código: uma cor nova entra sem mudar o avatar.

### Critérios de aceite
- [x] Sete cores de corpo disponíveis no avatar e na página de desenvolvimento.
- [x] Capturas de cada cor aprovadas pelo Wellington antes de entrarem no `docs/design-visual.md`.
- [x] Trocar a cor não recria materiais nem geometrias (só muda cores), sem custo perceptível.

## Movimento expressivo

### Trajeto flutuante (contexto Presença, domínio)
- Para ir de um ponto a outro, o Kobi faz um **voo**: acelera suavemente, cruza e desacelera até parar, sem arrancos.
- O trajeto pode ir em **qualquer direção** (horizontal, vertical, diagonal) e tem uma leve **ondulação lateral**, como quem flutua no ar, que some na chegada para ele parar exatamente no destino.
- A duração depende da distância, com velocidade máxima configurável; trajetos curtos não ficam lentos nem bruscos.
- É uma regra pura do domínio, testada e independente da taxa de quadros: dado o tempo desde o início, devolve a posição. A janela do Kobi segue essa posição (`docs/performance.md`: o Kobi se move movendo a janela).
- Vale para qualquer configuração de monitores: o voo atravessa monitores normalmente, e `DisplayLayout` continua garantindo que o destino é visível.

### Reação do corpo (avatar)
O avatar recebe a velocidade atual do deslocamento e reage:
1. **Virar para onde vai:** gira em torno do eixo vertical (da altura) na direção do movimento. Indo para a direita, vira de perfil para a direita; para a esquerda, para a esquerda; subindo ou descendo na vertical, fica de frente. Em diagonal, um meio-termo. Parado, volta a ficar de frente para o usuário, na pose de 3/4 do protótipo. O giro é suave, sem estalos.
2. **Inclinação em pêndulo:** a **base do corpo fica fixa** e a cabeça vai à frente ou para trás, girando em torno da base. Ao acelerar, inclina para a frente (na direção do movimento); em velocidade constante, mantém uma leve inclinação; ao frear, joga a cabeça para trás e oscila um pouco, amortecendo, até ficar reto.
3. **Poeira de derrapagem:** em arrancadas e freadas fortes, uma poeira singela sai do chão junto à base: na arrancada fica para trás, na freada é lançada para a frente (e fica no lugar da derrapagem enquanto o Kobi passa). Voos calmos não levantam poeira; quanto mais brusca a aceleração, mais poeira, singela mas bem visível (opacidade máxima de 60%, no máximo 96 nuvenzinhas; reforçada em 2026-10-07 a pedido do Wellington) e de cor neutra que aparece em fundos claros e escuros. A poeira fica parada na tela enquanto a janela do Kobi se move e some suavemente antes da borda da janela, sem precisar de outra janela.
4. A flutuação (subir e descer), o balanço, o piscar e o aceno continuam por cima do movimento.
5. O giro manual pelo usuário (arrastar com o botão direito ou a rodinha) continua funcionando; o giro do movimento se soma a ele.

- Tudo calculado pelo tempo decorrido: o mesmo voo tem a mesma aparência a 60, 100 ou 144 Hz.
- Respeita "reduzir movimento" do sistema: o Kobi ainda vira para onde vai, mas sem a oscilação do pêndulo e sem poeira.

### Custo
O giro e a inclinação são duas rotações a mais por quadro, custo desprezível perto da renderização. A poeira usa um conjunto fixo de sprites criado uma vez (sem alocação por quadro), desenhados só enquanto visíveis.

### Critérios de aceite
- [x] Voo no domínio com testes: começa e termina parado, chega exatamente ao destino, ondulação limitada e nula nas pontas, duração proporcional à distância com mínimo e máximo, qualquer direção.
- [x] Reação do corpo com testes: giro para o lado do movimento, de frente na vertical e parado, inclinação para a frente ao acelerar, para trás e amortecida ao frear, mesmo resultado em taxas de quadros diferentes.
- [x] Inclinação com pivô na base: a base não se desloca quando o Kobi inclina.
- [x] Poeira com testes: nenhuma em voos calmos, para trás na arrancada, para a frente na freada, discreta, parada na tela, some antes da borda, mesma quantidade em taxas de quadros diferentes, desligada com "reduzir movimento".
- [x] Parado, o avatar continua idêntico ao protótipo v6 (mesma comparação visual do passo 2).
- [x] Página de desenvolvimento onde um clique em qualquer ponto faz o Kobi voar até lá, para avaliar o movimento.

## Fora do escopo
- Passeio autônomo (quando e para onde o Kobi vai sozinho) e física ao soltar após arrastar (Fase 2).
- Escolha da cor pela interface do app, por voz e pelo menu (Fase 2, com o registro de configurações).
- Desviar de janelas ou do cursor.

## Desempenho
Sem impacto mensurável: medir na página de desenvolvimento que o tempo de quadro com o Kobi voando é o mesmo que parado.
