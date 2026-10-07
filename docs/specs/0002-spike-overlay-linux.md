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
| Ambiente de referência | 3 monitores com escala 1.0: DVI-I-2 via **adaptador USB DisplayLink** (1920×1080) à esquerda, eDP-1 do notebook (1920×1200, 60 Hz, principal) no centro, HDMI-1 (1920×1080, 100 Hz) à direita, desalinhados em 120 px | físico |
| Monitor único | só o notebook | físico (desconectando os externos) |
| Dois monitores, taxas diferentes | 60 Hz + 100 Hz | físico |
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

## Andamento (atualizado em 2026-10-07)

### Feito
- **Domínio (Presença):** `Rect`, `Display`, `DisplayLayout` (monitor sob um ponto, mais próximo, o que contém a janela, `onScreen`/`keepOnScreen` pela silhueta, passeio), `Flight` (voo, spec 0004) e `Glide` (arremesso, spec 0005). Testes cobrem a matriz de monitores (`@kobi/domain/testing`).
- **Aplicação:** portas `OverlayWindow` (posição, silhueta, região interativa) e `DisplaySource`; casos de uso `PlaceKobiOnStartup`, `KeepKobiVisible`, `PlanGlide`.
- **Avatar:** v6 portado para three.js 0.186, idêntico ao protótipo (diferença média < 1/255, `packages/avatar/dev/capture.ts`); cores do corpo, giro, pêndulo e poeira (spec 0004); alça do fone com o dobro da espessura.
- **Estratégia A (XWayland) implementada** em `apps/desktop`: janela transparente sempre acima em todas as áreas de trabalho, arrastar, girar (rodinha), menu (passeio de teste, diagnóstico, sair), arremesso, resgate após hotplug, clique atravessando fora do Kobi.

### Descobertas da estratégia A (entram no ADR)
- **Mutter restringe janelas X11 comuns:** mantém o retângulo inteiro dentro da faixa vertical de *todos* os monitores (0–1200 no ambiente de referência), não da altura de cada um. Medido com janelas de teste. Só o tipo **`dock`** fica livre; `toolbar`, `notification` e `splash` são restringidos como as comuns. O app usa `dock`. A verificar: foco de teclado em janelas `dock` (necessário para o modo texto).
- **`setShape` do Electron no X11 recorta o desenho (forma *bounding*), não só o mouse.** Por isso, em movimento ou com poeira no ar a janela inteira fica ativa; parado, a forma justa (≈30% da janela) deixa o clique atravessar. Comparar com a região de entrada do Wayland (estratégia B), que pode ser separada do desenho.
- **`setPosition` recusa −0** (não é inteiro de 32 bits no V8): posições passam por `Math.round(v) + 0`.
- Terminais do VS Code herdam `ELECTRON_RUN_AS_NODE=1`; o `scripts/start.mjs` remove.
- Hipóteses 1 (fundo transparente) e 3 (clique atravessando) confirmadas pelo Wellington; travessia entre os três monitores, incluindo o DisplayLink, funcionando.

### Falta
1. **Fechar a estratégia A:** observações do Wellington sobre a hipótese 2 (por cima de janela maximizada, da Visão geral e de app em tela cheia) e fps do diagnóstico nos monitores de 60 Hz e 100 Hz; medir CPU/GPU/memória (tabela "Medições"); casos da matriz ainda não testados (escala fracionária, monitor único, hotplug).
2. **Estratégia B:** Electron nativo no Wayland (`KOBI_OVERLAY=wayland pnpm --filter @kobi/desktop start`) + extensão GNOME mínima em `extensions/gnome/` (GPL-2.0-or-later, D-Bus), implementando a porta `OverlayWindow`.
3. **Comparar** as duas com a mesma tabela de medições e escrever o **ADR da estratégia de overlay no Linux**.

### Como rodar
- App: `pnpm --filter @kobi/desktop start` (estratégia A por padrão).
- Página do avatar, comparação com o v6 e playground de movimento: `pnpm --filter @kobi/avatar dev` → `http://localhost:5173/compare.html` e `/playground.html`.
