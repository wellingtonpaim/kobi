# 0002 — Spike: overlay do Kobi no GNOME Wayland

- Fase: 1
- Status: aprovada

## Objetivo
Responder, com o Kobi v6 rodando de verdade, a pergunta de maior risco do projeto: **dá para ter um avatar 3D transparente, sempre no topo, com clique atravessando fora dele, andando e sendo arrastado entre monitores no GNOME Wayland, com a qualidade e a fluidez do protótipo, em qualquer configuração de monitores?** O spike termina com a **decisão da estratégia de overlay no Linux**, registrada num ADR.

O GNOME Wayland vem primeiro porque é o cenário mais restritivo e é o ambiente de desenvolvimento. A solução, porém, precisa servir a qualquer pessoa: o Kobi é distribuído gratuitamente e vai rodar com um único monitor ou com vários, em qualquer disposição, escala e taxa de atualização, no Windows, no macOS e em várias distros Linux. **Nada no desenho pode depender de uma configuração específica.**

## Princípios de generalidade
Valem para esta spec e para tudo que nascer dela:

1. **Número e disposição de monitores livres:** de 1 a N, lado a lado, empilhados, em L, desalinhados, com coordenadas negativas, com vãos entre eles e com o principal em qualquer posição. A área útil é a união dos monitores, não um retângulo.
2. **Propriedades por monitor:** resolução, escala (inteira ou fracionária, misturadas entre monitores), taxa de atualização (60, 75, 100, 120, 144 Hz, variável) e rotação são lidas de cada monitor, nunca supostas.
3. **Mudanças em tempo real:** ligar ou desligar um monitor, mudar resolução, escala, disposição ou o monitor principal com o app aberto. O Kobi nunca fica perdido fora da área visível: se o monitor onde ele está some, ele reaparece no monitor mais próximo.
4. **Animação independente da taxa de quadros:** toda animação e suavização é calculada pelo tempo decorrido, nunca por quadro. O Kobi se move na mesma velocidade num monitor de 60 Hz e num de 144 Hz, e ao atravessar de um para o outro. (O v6 tem um ponto dependente de quadro, a suavização da rotação `curY += (alvo - curY) * 0.08`, que precisa virar decaimento por tempo.)
5. **Nitidez por monitor:** o supersampling considera a escala do monitor atual e se recalcula quando o Kobi muda para um monitor de escala diferente.
6. **Plataforma isolada atrás de portas:** tudo o que é específico do sistema (janela overlay, monitores, ponteiro, extensão GNOME, XWayland) fica atrás de portas com uma implementação por plataforma (padrão Strategy). Windows, macOS, X11 e outros compositores Wayland (KDE/wlroots com layer-shell) entram depois como novas implementações, sem mudar o núcleo.
7. **Degradação graciosa:** se um recurso não existe na plataforma (por exemplo, a extensão GNOME não instalada), o Kobi continua funcionando no melhor modo possível e explica ao usuário o que falta, em vez de falhar.

## Matriz de testes
O ambiente do Wellington é o **primeiro caso da matriz**, não o alvo:

| Caso | Configuração | Como testar no spike |
|---|---|---|
| Ambiente de referência | 3 monitores com escala 1.0: DVI-I-2 via **adaptador USB DisplayLink** (1920×1080, 100 Hz) à esquerda, eDP-1 do notebook (1920×1200, 60 Hz, principal) no centro, HDMI-1 (1920×1080, 100 Hz) à direita, desalinhados em 120 px | físico |
| Monitor único | só o notebook | físico (desconectando os externos) |
| Dois monitores, taxas diferentes | 60 Hz + 100 Hz | físico (já coberto pelo ambiente de referência) |
| Escala fracionária e mista | um monitor a 125% ou 150%, outro a 100% | físico (Configurações → Telas) |
| Disposição empilhada e coordenadas negativas | monitor acima ou à esquerda do principal | físico, reorganizando em Configurações |
| Hotplug | desconectar e reconectar o monitor onde o Kobi está | físico |
| 4 ou mais monitores, alta resolução (4K, escala 200%) | virtual | sessão GNOME aninhada/virtual com monitores virtuais (mutter devkit; forma exata a confirmar no spike) |
| Driver/GPU diferente | DisplayLink já cobre um caminho de cópia por CPU; outros GPUs ficam para testes da comunidade | físico + registro |

- **Regras de geometria são do domínio:** layout dos monitores, união da área útil, monitor mais próximo, travessia entre monitores e posição segura após hotplug são regras puras em `packages/domain` (contexto **Presença**), testadas com TDD para todos os casos da matriz e mais os de borda (vãos, coordenadas negativas, monitor único, escalas mistas). É isso que garante a generalidade sem depender de hardware.
- Casos que o spike não consegue testar fisicamente ficam registrados no ADR como pendentes da Fase 8 (multiplataforma) ou da comunidade.

## Estratégias candidatas (GNOME Wayland)
O spike implementa as duas e compara com dados. Ambas implementam a porta `OverlayWindow`, então a escolhida vira código de produção sem reescrever o resto.

| | A — XWayland | B — Wayland nativo + extensão GNOME |
|---|---|---|
| Como | Electron com `--ozone-platform=x11` | Electron nativo no Wayland; extensão GJS posiciona e mantém no topo via D-Bus |
| Sempre no topo | `setAlwaysOnTop` (X11) | `Meta.Window.make_above()` pela extensão |
| Posicionar / andar | `setPosition` | `move_frame()` pela extensão |
| Clique atravessando | forma de entrada X11 (`setShape`) ou `setIgnoreMouseEvents` alternado | região de entrada Wayland (`setShape`, se o Electron aplicar no Ozone Wayland) ou `setIgnoreMouseEvents` alternado com a posição do ponteiro informada pela extensão |
| Arrastar | movimento manual pelo `setPosition` | movimento interativo do compositor (`-webkit-app-region: drag`) ou pela extensão |
| Prós esperados | sem extensão, APIs conhecidas, mesma família de APIs do X11 puro | nitidez nativa em escala fracionária, integração oficial com o GNOME |
| Riscos | XWayland pode sair do GNOME no futuro; escala fracionária borrada; regras de "acima" do Mutter para X11 | exige instalar a extensão; `setShape` pode não valer no Wayland; mais peças |

O resultado pode ser também uma **combinação** (por exemplo, B quando a extensão está instalada e A como alternativa), desde que justificada no ADR.

Hipóteses que o spike precisa confirmar ou derrubar, com evidência (vídeo, log ou medição), em cada caso da matriz que se aplica:
1. `transparent: true` + `frame: false` dá fundo realmente transparente, sem borda nem sombra.
2. A janela continua por cima de: janelas maximizadas, troca de área de trabalho, Visão geral (Activities) e um app em tela cheia (na tela cheia, o esperado no produto é esconder o Kobi; aqui basta saber se ele é detectável).
3. O clique atravessa a área transparente e é capturado só nos pixels do avatar, sem atraso perceptível na troca.
4. O Kobi atravessa a fronteira entre quaisquer dois monitores (alinhados ou não, de escalas e taxas diferentes) sem salto, rasgo, borrão ou queda de quadros.
5. O Electron não pausa nem desacelera a renderização quando a janela perde o foco ou fica sem interação.
6. O app percebe mudanças de monitores (hotplug, escala, disposição) e reposiciona o Kobi sem reiniciar.

## Comportamento

### Janela e avatar
- A janela tem **só o tamanho do Kobi** (com folga para animação e sombra), nunca um canvas cobrindo os monitores. O Kobi se move movendo a janela (`docs/performance.md`). Isso também evita limites de tamanho de janela e de textura com muitos monitores ou monitores 4K.
- O avatar é o **v6 portado para `packages/avatar`**, fiel ao protótipo: mesmas geometrias, proporções, cores, materiais foscos, ambiente de estúdio pré-calculado, sombra no chão, piscar, flutuação e aceno.
- **Migração do three.js r128 → 0.186:** mudaram o gerenciamento de cor (`outputEncoding` → `outputColorSpace`) e as unidades físicas das luzes. Intensidades e exposição precisam ser recalibradas até o resultado bater com o protótipo.
- Supersampling 3× como no v6, ajustado à escala do monitor atual (princípio 5), com a redução para a tela feita em alta qualidade.
- A animação segue a taxa do monitor onde o Kobi está, com teto configurável. O spike mede se 100 Hz ou mais custa caro o bastante para justificar um teto de 60 fps por padrão.

### Interação
- **Arrastar** com o botão esquerdo move o Kobi pela tela e entre monitores.
- **Girar** com a rodinha ou com o botão direito, como no gesto do protótipo.
- **Clique fora do avatar** chega à janela que está atrás.
- **Passeio de teste:** um comando de desenvolvimento faz o Kobi percorrer todos os monitores conectados, seja qual for a quantidade e a disposição, em velocidade constante. Serve para medir fluidez em movimento programático; o passeio de verdade é da Fase 2.
- **Saída de emergência:** um atalho ou o menu da bandeja encerra o app, para nunca prender o usuário durante o spike.

### Extensão GNOME (estratégia B)
- Pasta `extensions/gnome/`, licença GPL-2.0-or-later, GNOME 50 (módulos ES). Versões anteriores do GNOME ficam registradas como pendência.
- Expõe uma interface D-Bus mínima, por exemplo `io.github.wellingtonpaim.Kobi.Overlay`: manter a janela do Kobi acima, mover para uma posição global e informar a posição do ponteiro (só se a alternativa do clique atravessando precisar).
- Identifica a janela do Kobi por identificador próprio (`wm_class`/app id), nunca agindo sobre outras janelas.
- Sem polling contínuo: eventos ou chamadas sob demanda.
- Sem a extensão, o app detecta a ausência e cai para a outra estratégia ou para um modo limitado (princípio 7).

## Medições
Para cada estratégia, registrar numa tabela no ADR, por caso da matriz testado:

| Métrica | Meta (`docs/performance.md`) |
|---|---|
| Quadros por segundo e tempo de quadro (p50, p95, p99), parado | estável na taxa do monitor (mínimo 60 fps), quadro < 16 ms |
| Idem, arrastando e no passeio de teste, incluindo a travessia entre monitores | sem quedas |
| CPU do app (todos os processos), parado e em movimento | < 5% parado, < 10% em movimento |
| Uso de GPU e CPU do `gnome-shell` com o Kobi visível | sem aumento perceptível |
| Memória total do app | até ~1 GB |
| Atraso para o clique atravessar / voltar a capturar | imperceptível |
| Tempo para reposicionar após hotplug ou mudança de escala | imperceptível, sem reiniciar |
| Nitidez comparada ao protótipo no navegador, em escala 100% e fracionária | igual |

- Um painel de diagnóstico de desenvolvimento mostra fps, tempo de quadro e o monitor atual (resolução, escala, taxa) na própria janela.
- Medir à parte o monitor do adaptador DisplayLink, que costuma ter custo extra de CPU. Ele representa um caso real de usuários com docks USB.
- As metas valem para a máquina de referência. A qualidade adaptativa de `docs/performance.md` protege a fluidez em máquinas mais fracas, e o spike deve deixar o caminho para ela aberto.

## Organização do código
- `packages/domain` (contexto **Presença**): value objects e regras de geometria dos monitores (layout, área útil, monitor mais próximo, travessia, posição segura), com TDD e cobertura da matriz.
- `packages/application`: a porta `OverlayWindow` e a porta de leitura dos monitores (`DisplaySource`), com os casos de uso mínimos do spike (posicionar, mover, reagir a mudanças de monitores).
- `packages/avatar`: cena three.js do v6 como módulo TypeScript, sem conhecer Electron (apresentação). Recebe um canvas e o tempo decorrido, e expõe comandos simples (cor dos LEDs, cor do corpo, girar, escala de renderização).
- `apps/desktop`: Electron (main, preload e renderer) com o composition root e as implementações das portas para o Linux. A leitura dos monitores usa a API `screen` do Electron (multiplataforma) como ponto de partida.
- `extensions/gnome`: extensão mínima da estratégia B.
- Código de spike pode ser exploratório, mas o que sobreviver à decisão é limpo e testado antes do merge na Fase 2. Regras puras já nascem com testes.
- Fronteiras novas entram no `.dependency-cruiser.cjs` e `apps/` entra no `check:boundaries`.

## Fora do escopo
- Física ao soltar, passeio autônomo, menu rápido, balão, bandeja completa e i18n (Fase 2).
- Expressões no display por shader SDF (Fase 6); o spike usa os olhos do v6.
- Esconder em tela cheia e Fantasminha.
- Implementações para Windows, macOS, X11 puro e KDE/wlroots (Fase 8). O spike só garante que as portas não impedem essas implementações.
- Publicar a extensão no site do GNOME.

## Critérios de aceite
- [ ] O Kobi v6 roda numa janela Electron transparente, sem borda nem sombra, por cima das outras janelas, nas duas estratégias (ou com evidência de por que uma delas é inviável).
- [ ] Captura lado a lado: o avatar no app é visualmente indistinguível do protótipo no navegador (formas, cores, iluminação, nitidez), em escala 100% e fracionária.
- [ ] Clique atravessa fora do avatar; arrastar e girar funcionam no avatar.
- [ ] Arrastar e o passeio de teste atravessam todos os monitores, em todos os casos físicos da matriz, sem salto nem queda de quadros.
- [ ] Hotplug e mudança de escala com o app aberto: o Kobi continua visível e nítido, sem reiniciar.
- [ ] A animação tem a mesma velocidade em monitores de taxas diferentes.
- [ ] Regras de geometria dos monitores no domínio, com testes para todos os casos da matriz e os de borda.
- [ ] Nenhuma regra fora das implementações de plataforma supõe número de monitores, disposição, escala, taxa ou sistema operacional.
- [ ] Tabela de medições preenchida para as duas estratégias, por caso testado.
- [ ] As seis hipóteses respondidas com evidência.
- [ ] ADR com a estratégia de overlay escolhida para o Linux, os números, os casos pendentes e as consequências para as outras plataformas.
- [ ] `pnpm check` e os pipelines passando.

## Desempenho
Esta spec é, ela própria, a primeira medição real do orçamento de `docs/performance.md`. Os números obtidos substituem as metas iniciais onde fizer sentido, registrados no ADR.

## Andamento (atualizado em 2026-10-08)

### Feito
- **Domínio (Presença):** `Rect`, `Display`, `DisplayLayout` (monitor sob um ponto, mais próximo, o que contém a janela, `onScreen`/`keepOnScreen` pela silhueta, passeio), `Flight` (voo, spec 0004) e `Glide` (arremesso, spec 0005). Testes cobrem a matriz de monitores (`@kobi/domain/testing`).
- **Aplicação:** portas `OverlayWindow` (posição, silhueta, região interativa) e `DisplaySource`; casos de uso `PlaceKobiOnStartup`, `KeepKobiVisible`, `PlanGlide`.
- **Avatar:** v6 portado para three.js 0.186, idêntico ao protótipo (diferença média < 1/255, `packages/avatar/dev/capture.ts`); cores do corpo, giro, pêndulo e poeira (spec 0004); alça do fone com o dobro da espessura.
- **Estratégia B (Wayland nativo + extensão GNOME) implementada**: extensão em `extensions/gnome/` (GPL-2.0-or-later, D-Bus `io.github.wellingtonpaim.Kobi.Overlay`) e adaptador `GnomeShellOverlayWindow`. Validada de ponta a ponta numa sessão GNOME 50 aninhada e headless com ponteiro virtual (`extensions/gnome/dev/interaction-test.sh`; com `KOBI_OVERLAY=x11` o mesmo roteiro testa a estratégia A no XWayland aninhado): transparência, acima e em todas as áreas de trabalho, posição inicial, clique atravessando, clique no corpo, arraste e arremesso entre monitores.
- **Escolha da estratégia em tempo de execução:** `KOBI_OVERLAY=wayland` usa a B; se a extensão não estiver ativa, o app reabre via XWayland (estratégia A), sem falhar.
- **Estratégia A (XWayland) implementada** em `apps/desktop`: janela transparente sempre acima em todas as áreas de trabalho, arrastar, girar (rodinha), menu (passeio de teste, diagnóstico, sair), arremesso, resgate após hotplug, clique atravessando fora do Kobi.

### Descobertas da estratégia A (entram no ADR)
- **Mutter restringe janelas X11 comuns:** mantém o retângulo inteiro dentro da faixa vertical de *todos* os monitores (0–1200 no ambiente de referência), não da altura de cada um. Medido com janelas de teste. Só o tipo **`dock`** fica livre; `toolbar`, `notification` e `splash` são restringidos como as comuns. O app usa `dock`. A verificar: foco de teclado em janelas `dock` (necessário para o modo texto).
- **`setShape` do Electron no X11 recorta o desenho (forma *bounding*), não só o mouse.** Por isso, em movimento ou com poeira no ar a janela inteira fica ativa; parado, a forma justa (≈30% da janela) deixa o clique atravessar. Comparar com a região de entrada do Wayland (estratégia B), que pode ser separada do desenho.
- **`setPosition` recusa −0** (não é inteiro de 32 bits no V8): posições passam por `Math.round(v) + 0`.
- **Arremesso rápido perdia o soltar** (~1 em 5 no teste de interação): parado, a forma X11 é justa; num arremesso o ponteiro sai dela antes de a janela alcançá-lo, e o botão era solto fora da área que recebe o mouse, deixando o Kobi preso ao mouse. Agora, enquanto o Kobi está seguro, a janela inteira recebe o mouse; e a interface encerra o arraste também ao ver um movimento sem botão pressionado ou ao perder o ponteiro.
- **XWayland atrasa a posição do ponteiro quando a janela anda junto com ele:** ele converte as coordenadas com a posição da janela X11 que conhece, que chega atrasada. O soltar pode vir com até um passo de movimento de diferença (imperceptível com um mouse real; 15 px nos passos grandes do teste). `screen.getCursorScreenPoint()` repete o último evento recebido; no X11 o arraste usa as coordenadas dos próprios eventos. Na estratégia B a posição é exata.
- Terminais do VS Code herdam `ELECTRON_RUN_AS_NODE=1`; o `scripts/start.mjs` remove.
- Hipóteses 1 (fundo transparente) e 3 (clique atravessando) confirmadas pelo Wellington; travessia entre os três monitores, incluindo o DisplayLink, funcionando.
- **Hipótese 5 confirmada com medição:** o app roda sem foco (`showInactive`) durante todo o `bench` e mantém a taxa cheia de cada monitor.
- **Hipótese 4 confirmada com medição** (em movimento programático): nos segundos com travessia entre monitores, o maior intervalo entre quadros foi 22 ms, ou seja, no máximo um quadro perdido. Falta o arraste manual.
- **A leitura do canvas para o clique atravessando custava ~10 quadros perdidos por segundo.** O `HitSampler` lia o canvas visível (`drawImage` + `getImageData`) a cada 100 ms, e isso obrigava o renderer a esperar a GPU (intervalos de 26,7 ms seguidos de 6,7 ms). Agora o avatar redesenha a cena num render target minúsculo e lê de forma assíncrona (PBO + fence do WebGL2, `readRenderTargetPixelsAsync`): o intervalo fica cravado na taxa do monitor, e a região resultante coincide com a antiga (diferença ≤ 1 célula de 4 px). Vale para qualquer estratégia.
- **O evento `moved` não dispara quando o próprio app chama `setPosition`** (X11): o monitor atual passou a ser conferido a cada movimento, com o layout em cache.
- **No Wayland nativo o Electron informa `displayFrequency = 0`** em todos os monitores (cai em `UNKNOWN_REFRESH_FALLBACK`). A estratégia B precisa obter a taxa por outro caminho (extensão ou medida pelo intervalo do rAF).
- O XWayland informa 59,88 Hz para o eDP-1, que o Mutter declara a 60,003 Hz.
- **Escala fracionária leva o XWayland inteiro a 2×** (GNOME 50, escala nativa do XWayland): com o eDP-1 a 125%, as coordenadas X11 dobram (o eDP-1 vira 3072×1920 no `xrandr`, `Xft.dpi` 192) e o Electron vê **todos** os monitores a 2×, inclusive os de 100%. Consequências medidas:
  - **O Kobi encolhe à metade em todos os monitores:** a janela X11 mantém o tamanho em pixels (300×400), que a 2× valem 150×200 lógicos. Corrigível no app (refazer o tamanho lógico quando a escala muda), ainda não feito.
  - **O GNOME move a janela X11 para outro monitor quando a escala do XWayland muda:** preserva a posição relativa (≈43% × 31% antes e depois), mas no monitor errado (centro do monitor da esquerda numa vez, do da direita em outra). Medido com a posição real da janela X11 lida a cada 100 ms e com o log do app: no primeiro aviso de mudança a janela já estava no outro monitor, e o resgate (`KeepKobiVisible`) não a moveu. Contornável só no app, lembrando o monitor e a posição relativa e voltando para eles; ainda não feito.
  - **Custo de 4× pixels também nos monitores de 100%,** mais a redução feita pelo compositor: tabela de 125% acima.
  - Na B nada disso acontece: cada monitor tem a própria escala, e o GNOME mantém a janela Wayland no mesmo lugar ao mudar a escala.
- **Visão geral:** a janela `dock` some enquanto a visão geral está aberta (nos três monitores) e volta ao mesmo lugar; na B o Kobi vira miniatura ao lado das outras janelas (teste guiado, passo 6A).
- **O painel de diagnóstico era recortado pela forma X11** (achado do Wellington no teste guiado): aparecia só onde encostava na silhueta, e o pedaço oscilava com a flutuação. Tudo que a janela desenha fora do Kobi (hoje o painel; no futuro balão e menu, se ficarem na mesma janela) precisa entrar na forma, e ali o clique também deixa de atravessar. A porta da plataforma ganhou `revealArea`, que no Wayland não faz nada.

### Descobertas da estratégia B (entram no ADR)
- **O Mutter restringe janelas Wayland comuns como as X11 comuns** (`move_frame` normal): mantém a janela inteira na faixa vertical de todos os monitores e abaixo do painel. Como operação do usuário (`move_frame(true, …)`), a restrição some, e a janela vai a qualquer posição. Quem mantém o Kobi visível é o domínio (`keepOnScreen`), como na A.
- **`setShape` não vira região de entrada no Ozone Wayland:** o clique na área transparente continuava indo para o Kobi. **`setIgnoreMouseEvents(true)` funciona.** A extensão acompanha o ponteiro pelo `CursorTracker` do Mutter (evento, sem polling), confere a região interativa enviada pelo app e avisa só o Kobi (sinal D-Bus endereçado) quando o ponteiro entra ou sai dela; o app alterna `setIgnoreMouseEvents` e, durante o arraste, não solta o mouse. Diferente da A, o desenho não é recortado: a região de entrada é separada do desenho.
- **O GNOME tira o "todas as áreas de trabalho" ao voltar ao monitor principal** (achado do Wellington no teste guiado; reproduzido na sessão aninhada): com áreas de trabalho só no monitor principal (padrão), a janela que volta ao principal é presa à área ativa, e o Kobi deixava de acompanhar o usuário. A extensão agora refaz "acima" e "todas as áreas de trabalho" assim que o GNOME os desfaz (por evento). Coberto pelo teste de interação.
- **Visão geral:** o Kobi aparece como miniatura ao lado das outras janelas e volta ao mesmo lugar ao sair (confirmado na sessão real).
- **Tela cheia:** com "acima", o Kobi continua por cima de um vídeo em tela cheia em qualquer monitor, sem mudar de posição (teste guiado, Passo 7). Para se esconder em tela cheia (Fase 2), o app precisa saber quando o monitor onde ele está tem uma janela em tela cheia; no GNOME a extensão pode avisar por evento (sinal `in-fullscreen-changed` e `get_monitor_in_fullscreen` do Mutter), sem polling.
- **`setIgnoreMouseEvents(true)` só vale quando o ponteiro sai da janela inteira** (achado do Wellington no teste guiado; reproduzido isolado): depois de passar o mouse sobre o corpo, a área transparente continuava segurando o clique. Causa: o Clutter guarda a área em volta do ponteiro onde a escolha de quem recebe o mouse não muda e não a refaz quando a região de entrada ou a reatividade muda. **Solução (extensão versão 3):** a própria extensão liga e desliga a reatividade da superfície do Kobi conforme o ponteiro está ou não sobre o corpo (congelando enquanto há botão pressionado) e pede um relayout do ator, que invalida aquele cache; o app deixa de alternar `setIgnoreMouseEvents`. O efeito é imediato, mesmo saltando direto para o corpo e clicando parado.
- **No Wayland o Electron não sabe onde a janela está:** `getBounds()` fica na posição inicial e `screenX`/`screenY` valem 0; o ponteiro só é conhecido relativo à janela. Por isso a posição da janela agora vem do processo principal (após cada movimento) e o arraste e o arremesso leem o ponteiro global no processo principal (`screen.getCursorScreenPoint()` no X11, extensão no Wayland), igual nas duas estratégias.
- **app_id:** vem do `desktopName` do `package.json` (`io.github.wellingtonpaim.Kobi.desktop` → `io.github.wellingtonpaim.Kobi`, o mesmo id previsto para o Flatpak); `--class` não vale no Wayland. A janela nasce com `wm_class` nulo e o app_id chega depois (`notify::wm-class`).
- **A janela só existe para o compositor depois de aparecer:** a posição inicial é guardada e aplicada assim que a extensão enxerga a janela.
- **D-Bus é rápido o bastante:** ida e volta média de 0,43 ms (1000 `MoveTo` seguidos); os movimentos se fundem no mais recente enquanto um está a caminho, sem fila.
- **Visão geral:** o Kobi aparece como miniatura de janela dentro da área de trabalho, não flutuando por cima (observado na sessão aninhada; confirmar na sessão real).
- Segurança: a extensão só age sobre a janela com o app_id do Kobi **e** do mesmo processo que chamou (PID do remetente D-Bus).

### Medições da estratégia A (2026-10-07)
`pnpm --filter @kobi/desktop bench` (ambiente de referência, escala 1.0, app sem foco). CPU em % de um núcleo (média / p95 por segundo); a máquina tem 16 threads. GPU pelo `gpu_busy_percent` da Radeon integrada.

| Fase | Kobi (todos os processos) | Kobi (% da máquina) | gnome-shell | Xwayland | GPU ocupada |
|---|---|---|---|---|---|
| sem o Kobi | — | — | 1,1 / 2,0 | 0,0 / 0,0 | 0 / 0 |
| parado · DVI-I-2 DisplayLink (100 Hz) | 39,5 / 41,0 | 2,5 | 13,0 / 13,7 | 1,9 / 2,9 | 42,6 / 43,0 |
| parado · eDP-1 (60 Hz) | 26,1 / 28,3 | 1,6 | 8,3 / 8,8 | 1,2 / 2,0 | 25,9 / 27,0 |
| parado · HDMI-1 (100 Hz) | 36,9 / 41,9 | 2,3 | 11,3 / 12,6 | 1,7 / 1,9 | 44,1 / 49,0 |
| passeio de teste contínuo | 41,6 / 54,3 | 2,6 | 15,9 / 20,4 | 7,9 / 10,7 | 34,4 / 42,0 |

| Fase · monitor | s | fps médio | fps mín | perdidos | intervalo p95 | intervalo máx | render p95 |
|---|---|---|---|---|---|---|---|
| parado · DVI-I-2 (100 Hz) | 15 | 100,3 | 100 | 0 | 10,2 ms | 10,8 ms | 0,8 ms |
| parado · eDP-1 (60 Hz) | 16 | 60,5 | 60 | 0 | 17,1 ms | 17,5 ms | 0,9 ms |
| parado · HDMI-1 (100 Hz) | 15 | 100,1 | 99 | 2 | 10,2 ms | 20,6 ms | 0,9 ms |
| passeio · DVI-I-2 | 13 | 100,4 | 100 | 0 | 10,2 ms | 10,4 ms | 1,4 ms |
| passeio · eDP-1 | 19 | 60,3 | 59 | 3 | 17,0 ms | 31,0 ms | 1,1 ms |
| passeio · HDMI-1 | 13 | 100,2 | 99 | 1 | 10,2 ms | 23,6 ms | 1,2 ms |
| passeio · segundos com travessia | 16 | 89,6 | 72 | (\*) | 17,0 ms | 22,2 ms | 1,1 ms |

Memória do Kobi (PSS, todos os processos): ~306 MiB parado, ~309 MiB depois do passeio.

(\*) Um segundo com travessia mistura quadros de 60 Hz e de 100 Hz, e a contagem usa a taxa do monitor de chegada; o que vale ali é o intervalo máximo.

Leitura dos números:
- **Fluidez dentro da meta:** a animação acompanha a taxa de cada monitor, inclusive no DisplayLink, sem custo extra visível nele (mesmo patamar do HDMI de 100 Hz).
- **Custo parado acima do espírito da meta.** Pela máquina inteira dá 1,6–2,5% (dentro de "< 5%"), mas são 26–40% de um núcleo e 26–44% da GPU integrada só para flutuar, mais 7–12% de um núcleo no `gnome-shell`. A meta "< 5%" de `docs/performance.md` precisa dizer se é da máquina ou de um núcleo.
- **100 Hz custa ~50% a mais de CPU e ~65% a mais de GPU que 60 Hz.** É o dado que a spec pedia para decidir o teto de 60 fps por padrão (decisão do ADR).
- Mover a janela X11 custa ~6% de um núcleo no Xwayland e ~5% no `gnome-shell`.
- Hipóteses de redução de custo para avaliar antes do ADR: desenhar o WebGL direto no canvas visível (hoje há uma cópia WebGL → canvas 2D por quadro); supersampling 3× somado ao MSAA (`antialias: true`); desenhar parado a uma taxa menor quando só a flutuação se move.

### Medições da estratégia B (2026-10-08)
Mesmo `bench`, com `KOBI_OVERLAY=wayland`, na sessão real com a extensão versão 2 (monitores, principal e taxas lidos do GNOME). A linha de base do `gnome-shell` (1,2%) é a mesma da medição da A (1,1%), então as duas tabelas são comparáveis.

| Fase | Kobi (todos os processos) | Kobi (% da máquina) | gnome-shell | Xwayland | GPU ocupada |
|---|---|---|---|---|---|
| sem o Kobi | — | — | 1,2 / 2,0 | 0,0 / 0,0 | 0 / 0 |
| parado · DVI-I-2 DisplayLink (100 Hz) | 35,7 / 39,8 | 2,2 | 15,3 / 17,5 | 0,0 / 0,0 | 44,5 / 46,0 |
| parado · eDP-1 (60 Hz) | 23,8 / 28,3 | 1,5 | 9,8 / 11,7 | 0,0 / 0,0 | 27,4 / 29,0 |
| parado · HDMI-1 (100 Hz) | 34,6 / 36,9 | 2,2 | 14,3 / 15,6 | 0,0 / 0,0 | 44,2 / 45,0 |
| passeio de teste contínuo | 35,9 / 45,8 | 2,2 | 17,6 / 22,4 | 0,0 / 0,0 | 34,9 / 43,0 |

| Fase · monitor | s | fps médio | fps mín | perdidos | intervalo p95 | intervalo máx | render p95 |
|---|---|---|---|---|---|---|---|
| parado · DVI-I-2 (100 Hz) | 15 | 100,3 | 99 | 1 | 10,1 ms | 20,0 ms | 0,7 ms |
| parado · eDP-1 (60 Hz) | 15 | 60,8 | 60 | 1 | 16,8 ms | 33,3 ms | 0,8 ms |
| parado · HDMI-1 (100 Hz) | 16 | 100,3 | 99 | 1 | 10,1 ms | 20,0 ms | 0,8 ms |
| passeio · DVI-I-2 | 12 | 100,1 | 99 | 1 | 10,1 ms | 20,0 ms | 1,2 ms |
| passeio · eDP-1 | 19 | 60,8 | 60 | 0 | 16,8 ms | 16,8 ms | 1,1 ms |
| passeio · HDMI-1 | 15 | 100,4 | 99 | 1 | 10,1 ms | 20,1 ms | 0,9 ms |
| passeio · segundos com travessia | 15 | 89,5 | 71 | (\*) | 16,7 ms | 28,3 ms | 0,9 ms |

(\*) Mesma distorção de contagem da tabela da A.

**Comparação com a A** (% de um núcleo):

| | A (XWayland) | B (Wayland + extensão) |
|---|---|---|
| Kobi parado · DVI-I-2 / eDP-1 / HDMI-1 | 39,5 / 26,1 / 36,9 | 35,7 / 23,8 / 34,6 |
| Kobi no passeio | 41,6 | 35,9 |
| gnome-shell + Xwayland parado · DVI-I-2 / eDP-1 / HDMI-1 | 14,9 / 9,5 / 13,0 | 15,3 / 9,8 / 14,3 |
| gnome-shell + Xwayland no passeio | 23,8 | 17,6 |
| GPU | igual | igual |
| Memória parado | ~300 MiB | ~305 MiB |
| Memória em movimento contínuo | estável (299 → 301 MiB em 4 min) | sobe ~60 MiB e estabiliza (297 → ~355 MiB do 4º ao 9º minuto de 10) |

- **Fluidez igual** nas duas: taxa cheia de cada monitor, cerca de um quadro perdido a cada 15 s.
- **A B gasta menos CPU** no Kobi parado e sobretudo em movimento (o Xwayland sai da conta); parado, o custo de compositor fica igual.
- **Memória da B em movimento:** o processo principal cresce porque cada quadro em movimento é uma chamada D-Bus. Isolando a biblioteca (`@homebridge/dbus-native`, 100 mil chamadas `GetPointer` fora do Electron), o heap do V8 fica estável e a memória residente sobe até ~180 MiB nas primeiras 30 mil chamadas e para (é o alocador, não acúmulo); a `dbus-next` se comporta igual. Fica para o teste de longa duração da Fase 2 (dias aberto) confirmar, e para uma otimização possível: menos chamadas por movimento.

### Lacunas do Electron no Wayland (precisam de outra fonte na estratégia B)
O protocolo Wayland não entrega aos apps informações que o domínio usa. Medido na sessão real:
- **Monitor principal errado:** `screen.getPrimaryDisplay()` devolve o monitor em (0, 0) (o DisplayLink), não o eDP-1. O Kobi abre no canto do monitor errado.
- **Área útil sem o painel:** `workArea` é igual ao monitor inteiro (eDP-1 com y = 0 e altura 1200, contra 32 e 1168 no X11). O Kobi pode parar por baixo do painel superior.
- **Taxa de atualização 0** em todos os monitores (cai em 60 Hz).
**Resolvido com a extensão (versão 2):** `GetMonitors` devolve, por monitor, conector, geometria, área útil sem o painel, escala e principal (pelo Shell) e a taxa de atualização (pela interface D-Bus pública `org.gnome.Mutter.DisplayConfig`, cruzada pelo conector); o sinal `MonitorsChanged` avisa hotplug, escala, disposição e área útil, sem polling. No app, `GnomeShellDisplaySource` implementa a porta `DisplaySource` com esses dados (ids = conectores). Com a extensão na versão 1, o app segue com a API `screen` do Electron e avisa no log. Validado na sessão aninhada; falta conferir na sessão real.

### Teste guiado na sessão real (em andamento)
O Wellington executa cada passo e conta o que viu; o Claude confere pelo log do app (`[kobi] …`). Um passo por vez, respostas simples ("ok" ou o que foi diferente).

Estratégia B (Wayland + extensão), feitos em 2026-10-08:
| Passo | Resultado |
|---|---|
| 1. Onde aparece | ok: canto inferior direito do eDP-1 (principal), nítido, fundo transparente, 60 fps |
| 2. Clique atravessa | ok depois da correção da extensão v3 (antes: depois de passar sobre o corpo, a área transparente segurava o clique) |
| 3. Arrastar entre os monitores | ok: colado ao cursor, solta onde parou, painel troca de monitor e fps |
| 4. Arremessar | ok: freia suave, atravessa monitores, não some, pega no ar (velocidades de ~300 a ~18.800 px/s no log) |
| 5. Janela maximizada em foco | ok: continua por cima |
| 6A. Visão geral | miniatura ao lado das outras janelas; volta ao mesmo lugar |
| 6B. Trocar de área de trabalho | falhou e foi corrigido (commit `99d22cc`): o GNOME prendia o Kobi à área ativa ao voltar ao principal. Refeito com a extensão reinstalada e novo login: ok, indo e voltando dos monitores da esquerda e da direita, o Kobi continua visível e no mesmo lugar ao trocar de área de trabalho |
| 7. Tela cheia | o Kobi fica por cima do vídeo em tela cheia (F no navegador) nos três monitores e não sai do lugar ao entrar ou sair dela |

Estratégia A (XWayland), mesmos passos, feitos em 2026-10-08:
| Passo | Resultado |
|---|---|
| 1. Onde aparece | ok depois de uma correção: o painel de diagnóstico aparecia só em parte, e o pedaço oscilava com a flutuação (a forma X11 recorta o desenho e só cobria a silhueta). Agora a área do painel entra na forma (`revealArea`) |
| 2. Clique atravessa | ok, inclusive logo depois de passar o mouse pelo corpo |
| 3. Arrastar entre os monitores | ok |
| 4. Arremessar | ok: 15 arremessos de ~50 a ~18.400 px/s, para os dois lados, pegando no ar; nunca ficou preso ao mouse |
| 5. Janela maximizada em foco | ok: continua por cima |
| 6A. Visão geral | **some** nos três monitores (o GNOME não mostra janelas `dock` na visão geral) e volta ao mesmo lugar ao sair |
| 6B. Trocar de área de trabalho | ok, indo e voltando dos monitores da esquerda e da direita |
| 7. Tela cheia | por cima do vídeo nos três monitores, sem sair do lugar (igual à B) |

Casos da matriz, feitos em 2026-10-08:
| Caso | A (XWayland) | B (Wayland + extensão) |
|---|---|---|
| Escala fracionária (eDP-1 a 125%, externos a 100%) | **encolhe** à metade em todos os monitores e **salta para o centro de um monitor externo** a cada mudança de escala (ver descobertas da A); custo quase dobra nos externos (tabela abaixo) | ok: tamanho certo e nítido em cada monitor (1,25× e 1×), arraste colado na travessia entre escalas diferentes; ao mudar a escala com o app aberto, continua no mesmo lugar e o tamanho acompanha a escala |

Medições a 125% (`bench`, % de um núcleo, média; GPU em %):

| Fase | A: Kobi | A: gnome-shell | A: Xwayland | A: GPU | B: Kobi | B: gnome-shell | B: GPU |
|---|---|---|---|---|---|---|---|
| parado · DVI-I-2 (100 Hz, 1×) | 62,3 | 21,2 | 2,9 | 77,3 | 36,9 | 14,4 | 43,3 |
| parado · eDP-1 (60 Hz, 1,25×) | 28,3 | 9,3 | 1,3 | 44,7 | 24,1 | 9,3 | 32,1 |
| parado · HDMI-1 (100 Hz, 1×) | 64,0 | 19,8 | 3,0 | 78,1 | 34,7 | 12,7 | 43,8 |
| passeio | 65,6 | 26,4 | 12,8 | 65,2 | 40,3 | 18,9 | 38,2 |

Fluidez: as duas mantêm a taxa cheia de cada monitor; a A perde 3 a 5 quadros a cada 15 s (intervalo máximo até 36,6 ms), a B até 2 (máximo 33,4 ms). Memória: ~300 MiB nas duas. Na B os números são os mesmos de 100%; na A o custo quase dobra nos externos **com o Kobi encolhido à metade** (o mesmo número de pixels de antes); no tamanho certo seriam 4× mais pixels.

**Onde paramos (2026-10-08, fim do dia):** escala do eDP-1 de volta a 100% com a B aberta (ok). A extensão instalada e carregada é a do commit `99d22cc`. O GNOME realinhou os monitores depois das mudanças de escala: agora os externos ficam em y = 0 e o eDP-1 em y = 120 (antes era o contrário); não atrapalha. Próximo passo: **hotplug na B**, abrindo com o log (comando de "Como rodar", na estratégia B): Kobi num monitor externo, desconectar o cabo desse monitor com o app aberto, conferir se ele reaparece no monitor mais próximo, reconectar; depois o mesmo com o DisplayLink e, por fim, só o notebook (`bench` sem os externos). Em seguida, os mesmos casos na A.

Próximos passos do teste guiado:
1. **Casos da matriz** restantes (em cada um, `bench` + observação): só o notebook (desconectar os externos), hotplug (desconectar e reconectar o monitor onde o Kobi está, com o app aberto; o log mostra `[kobi] monitores mudaram` e a posição depois do resgate).
2. **Comparar** as duas estratégias e escrever o **ADR da estratégia de overlay no Linux** (em `docs/adr/`), com as tabelas, as descobertas, os casos pendentes e as consequências para as outras plataformas.

### Como rodar
- App: `pnpm --filter @kobi/desktop start` (estratégia A por padrão).
- Estratégia B: `KOBI_OVERLAY=wayland pnpm --filter @kobi/desktop start` (com a extensão ativa). Sessão aninhada e teste de interação: ver `extensions/gnome/README.md`.
- Teste guiado: abrir com o painel de diagnóstico desde o início e guardar o log, por exemplo `cd apps/desktop && node_modules/.bin/electron . --ozone-platform=wayland --kobi-diagnostics > /tmp/diario.log 2>&1` (rodar com `env -u ELECTRON_RUN_AS_NODE` no terminal do VS Code). O log mostra monitores lidos, mudanças de monitor, resgate e cada soltar com a velocidade.
- Teste automático de interação nas duas estratégias: `pnpm --filter @kobi/desktop build && extensions/gnome/dev/interaction-test.sh` (B) e `KOBI_OVERLAY=x11 extensions/gnome/dev/interaction-test.sh` (A).
- Medições: `pnpm --filter @kobi/desktop bench` (inclui memória por fase: início, fim, máximo e variação por minuto) (~2,5 min; feche o Kobi antes e não mexa no computador). Linha de base sem o Kobi, parado em cada monitor e passeio contínuo; imprime as tabelas acima. Durações por `KOBI_BENCH_BASELINE`, `KOBI_BENCH_IDLE` (por monitor) e `KOBI_BENCH_TOUR`; `KOBI_OVERLAY=wayland` para a estratégia B.
- Página do avatar, comparação com o v6 e playground de movimento: `pnpm --filter @kobi/avatar dev` → `http://localhost:5173/compare.html` e `/playground.html`.
