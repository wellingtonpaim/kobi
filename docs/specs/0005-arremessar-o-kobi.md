# 0005 — Arremessar o Kobi (impulso)

- Fase: 1 (antecipado da Fase 2, "física ao soltar", a pedido do Wellington)
- Status: aprovada

## Objetivo
Ao arrastar o Kobi e soltar com o mouse em movimento, ele continua com a velocidade imprimida e vai desacelerando pela resistência do ar até parar, como um objeto arremessado na vida real. Um arremesso forte leva o Kobi de um monitor a outro, inclusive de um extremo ao outro.

## Comportamento

### Arremesso
- A velocidade de saída é a velocidade do mouse nos últimos instantes do arraste (cerca de 80 ms). Se o mouse parou antes de soltar, o Kobi fica onde foi solto.
- Há um limite de velocidade de saída, para um movimento brusco acidental não lançar o Kobi longe demais.

### Deslizamento (contexto Presença, domínio)
- **Resistência do ar proporcional à velocidade:** a velocidade cai exponencialmente com o tempo, e a distância percorrida é proporcional à velocidade de saída (velocidade ÷ resistência).
- Calibração inicial: um arremesso forte (cerca de 4.000 px/s) percorre perto de 3.300 px e leva de 4 a 5 segundos para parar, o bastante para cruzar três monitores de 1920 px de largura.
- O deslizamento termina quando a velocidade fica abaixo de um mínimo quase imperceptível.
- **O Kobi nunca sai da área visível:** o centro dele fica sempre dentro da área útil de algum monitor. Ao bater numa borda (externa ou de um vão entre monitores), ele **quica** de leve: a componente da velocidade contra a borda inverte e perde a maior parte da energia.
- Vale para qualquer configuração de monitores, já que as bordas vêm de `DisplayLayout`.
- Calculado em passos fixos de tempo: o mesmo arremesso tem o mesmo trajeto a 60, 100 ou 144 Hz.

### Interação
- Clicar no Kobi durante o deslizamento o "pega" de novo: o deslizamento para e começa um novo arraste.
- Giro, pêndulo e poeira reagem ao deslizamento como a qualquer deslocamento (spec 0004).

## Fora do escopo
- Arremesso para cima com "gravidade" (o Kobi flutua; não cai).
- Reações de personalidade ao ser arremessado (Fase 6: tontura, reclamar, gostar).

## Critérios de aceite
- [ ] Deslizamento no domínio com testes: desacelera sem parar de repente, distância proporcional à velocidade de saída, para abaixo da velocidade mínima, limite de velocidade de saída, quica nas bordas perdendo energia, nunca sai da área útil, arremesso forte cruza do monitor da esquerda ao da direita no ambiente de referência.
- [ ] Velocidade de saída medida nos últimos instantes do arraste, com testes; mouse parado antes de soltar não arremessa.
- [ ] Clicar durante o deslizamento pega o Kobi.

## Desempenho
Sem custo extra: o trajeto é calculado uma vez ao soltar (alguns milhares de passos simples) e depois só lido a cada quadro.
