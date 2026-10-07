# 0002 — Spike: overlay do Kobi no GNOME Wayland

- Fase: 1
- Status: rascunho

## Objetivo
Responder, com o Kobi v6 rodando de verdade, a pergunta de maior risco do projeto: **dá para ter um avatar 3D transparente, sempre no topo, com clique atravessando fora dele, andando e sendo arrastado entre três monitores no GNOME 50 Wayland, com a qualidade e a fluidez do protótipo?** O spike termina com a **decisão da estratégia de overlay no Linux**, registrada num ADR.

Ao fim, o Wellington vê o Kobi flutuando por cima das janelas, arrasta ele de um monitor para outro e continua clicando normalmente no que está atrás.

## Ambiente de referência
- Fedora 44, GNOME Shell 50.5, sessão Wayland, três monitores com escala 1.0:

| Monitor | Posição | Modo |
|---|---|---|
| DVI-I-2 (provável adaptador USB/DisplayLink) | esquerda | 1920×1080 |
| eDP-1 (notebook, principal) | centro | 1920×1200 |
| HDMI-1 | direita | 1920×1080 |

- Taxas de atualização mistas: 100 Hz nos externos e 60 Hz no notebook. A medição de fluidez e de CPU precisa considerar os dois casos.
- Electron 44, three.js 0.186.

## Estratégias candidatas
O spike implementa as duas e compara com dados. Elas ficam atrás de uma porta `OverlayWindow` (padrão Strategy, `docs/engenharia.md`), para que a escolhida vire código de produção sem reescrever o resto.

| | A — XWayland | B — Wayland nativo + extensão GNOME |
|---|---|---|
| Como | Electron com `--ozone-platform=x11` | Electron nativo no Wayland; extensão GJS posiciona e mantém no topo via D-Bus |
| Sempre no topo | `setAlwaysOnTop` (X11) | `Meta.Window.make_above()` pela extensão |
| Posicionar / andar | `setPosition` | `move_frame()` pela extensão |
| Clique atravessando | forma de entrada X11 (`setShape`) ou `setIgnoreMouseEvents` alternado | região de entrada Wayland (`setShape`, se o Electron aplicar no Ozone Wayland) ou `setIgnoreMouseEvents` alternado com a posição do ponteiro informada pela extensão |
| Arrastar | movimento manual pelo `setPosition` | movimento interativo do compositor (`-webkit-app-region: drag`) ou pela extensão |
| Prós esperados | sem extensão, APIs conhecidas | nitidez nativa, integração oficial com o GNOME |
| Riscos | XWayland pode ser removido do GNOME no futuro; escala fracionária borrada; regras de "acima" do Mutter para X11 | exige instalar a extensão; `setShape` pode não valer no Wayland; mais peças |

Hipóteses que o spike precisa confirmar ou derrubar, com evidência (vídeo, log ou medição):
1. `transparent: true` + `frame: false` dá fundo realmente transparente, sem borda nem sombra, nas duas estratégias.
2. A janela continua por cima de: janelas maximizadas, troca de área de trabalho, Visão geral (Activities) e um app em tela cheia (na tela cheia, o esperado no produto é esconder o Kobi; aqui basta saber se ele é detectável).
3. O clique atravessa a área transparente e é capturado só nos pixels do avatar, sem atraso perceptível na troca.
4. O Kobi atravessa a fronteira entre monitores (inclusive a diferença de altura de 120 px entre eles) sem salto, rasgo ou queda de quadros.
5. O Electron não pausa a renderização quando a janela perde o foco ou fica sem interação.

## Comportamento

### Janela e avatar
- A janela tem **só o tamanho do Kobi** (com folga para animação e sombra), nunca um canvas cobrindo os monitores. O Kobi se move movendo a janela (`docs/performance.md`).
- O avatar é o **v6 portado para `packages/avatar`**, fiel ao protótipo: mesmas geometrias, proporções, cores, materiais foscos, ambiente de estúdio pré-calculado, sombra no chão, piscar, flutuação e aceno.
- **Migração do three.js r128 → 0.186:** mudaram o gerenciamento de cor (`outputEncoding` → `outputColorSpace`) e as unidades físicas das luzes, então intensidades e exposição precisam ser recalibradas até o resultado bater com o protótipo. Ver os critérios de aceite.
- Supersampling 3× como no v6, com a redução para a tela feita em alta qualidade.

### Interação
- **Arrastar** com o botão esquerdo move o Kobi pela tela e entre monitores.
- **Girar** com a rodinha ou com o botão direito, como no gesto do protótipo.
- **Clique fora do avatar** chega à janela que está atrás.
- **Passeio de teste:** um comando de desenvolvimento faz o Kobi atravessar os três monitores sozinho em velocidade constante. Serve para medir fluidez em movimento programático; o passeio de verdade é da Fase 2.
- **Saída de emergência:** um atalho ou o menu da bandeja encerra o app, para nunca prender o usuário durante o spike.

### Extensão GNOME (estratégia B)
- Pasta `extensions/gnome/`, licença GPL-2.0-or-later, GNOME 50 (módulos ES).
- Expõe uma interface D-Bus mínima, por exemplo `io.github.wellingtonpaim.Kobi.Overlay`: manter a janela do Kobi acima, mover para uma posição global e informar a posição do ponteiro (só se a alternativa do clique atravessando precisar).
- Identifica a janela do Kobi por identificador próprio (`wm_class`/app id), nunca agindo sobre outras janelas.
- Sem polling contínuo: eventos ou chamadas sob demanda.

## Medições
Para cada estratégia, com o Kobi visível nos três monitores (60 Hz e 100 Hz), registrar numa tabela no ADR:

| Métrica | Meta (`docs/performance.md`) |
|---|---|
| Quadros por segundo e tempo de quadro (p50, p95, p99), parado | 60 fps estáveis, quadro < 16 ms |
| Idem, arrastando e no passeio de teste | 60 fps sem quedas |
| CPU do app (todos os processos), parado e em movimento | < 5% parado, < 10% em movimento |
| Uso de GPU e CPU do `gnome-shell` com o Kobi visível | sem aumento perceptível |
| Memória total do app | até ~1 GB |
| Atraso para o clique atravessar / voltar a capturar | imperceptível |
| Nitidez comparada ao protótipo no navegador | igual |

- Um painel de diagnóstico de desenvolvimento mostra fps e tempo de quadro na própria janela.
- Medir também no monitor do adaptador DVI-I, que pode ter custo extra de CPU.
- Definir se a animação segue a taxa do monitor (100 Hz) ou fica limitada a 60 fps, conforme o custo medido.

## Organização do código
- `packages/avatar`: cena three.js do v6 como módulo TypeScript, sem conhecer Electron (apresentação). Recebe um canvas e expõe comandos simples (cor dos LEDs, cor do corpo, girar). Fica no projeto.
- `apps/desktop`: Electron (main, preload e renderer) com o composition root. As duas estratégias implementam a porta `OverlayWindow`.
- `extensions/gnome`: extensão mínima da estratégia B.
- Código de spike pode ser exploratório, mas o que sobreviver à decisão é limpo e ganha testes antes do merge na Fase 2. Regras puras (por exemplo, cálculo da região clicável ou da travessia entre monitores) já nascem com testes.
- Fronteiras novas entram no `.dependency-cruiser.cjs` e `apps/` entra no `check:boundaries`.

## Fora do escopo
- Física ao soltar, passeio autônomo, menu rápido, balão, bandeja completa e i18n (Fase 2).
- Expressões no display por shader SDF (Fase 6); o spike usa os olhos do v6.
- Esconder em tela cheia, Fantasminha e outras plataformas (KDE/layer-shell, X11 puro, Windows, macOS).
- Publicar a extensão no site do GNOME.

## Critérios de aceite
- [ ] O Kobi v6 roda numa janela Electron transparente, sem borda nem sombra, por cima das outras janelas, nas duas estratégias (ou com evidência de por que uma delas é inviável).
- [ ] Captura lado a lado: o avatar no app é visualmente indistinguível do protótipo no navegador (formas, cores, iluminação, nitidez).
- [ ] Clique atravessa fora do avatar; arrastar e girar funcionam no avatar.
- [ ] Arrastar e o passeio de teste atravessam os três monitores sem salto nem queda de quadros.
- [ ] Tabela de medições preenchida para as duas estratégias, nos monitores de 60 Hz e 100 Hz.
- [ ] As cinco hipóteses respondidas com evidência.
- [ ] ADR com a estratégia de overlay escolhida para o Linux, os números e as consequências.
- [ ] `pnpm check` e os pipelines passando.

## Desempenho
Esta spec é, ela própria, a primeira medição real do orçamento de `docs/performance.md`. Os números obtidos substituem as metas iniciais onde fizer sentido, registrados no ADR.
