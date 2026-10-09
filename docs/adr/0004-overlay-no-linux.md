# 0004 — Estratégia de overlay no Linux

- Status: proposta
- Data: 2026-10-09

## Contexto
O Kobi é uma janela transparente, sempre por cima, do tamanho do avatar, que anda entre os monitores, deixa o clique atravessar fora do corpo e roda o v6 a taxa cheia. No GNOME Wayland um app comum não pode se posicionar nem ficar acima das outras janelas. O spike da spec 0002 implementou e mediu duas estratégias, ambas atrás das mesmas portas (`OverlayWindow`, `DisplaySource`):

- **A — XWayland:** Electron com `--ozone-platform=x11`, janela do tipo `dock`, forma X11 para o clique atravessar.
- **B — Wayland nativo + extensão GNOME:** Electron nativo no Wayland; a extensão `kobi-overlay` (GPL-2.0-or-later, D-Bus `io.github.wellingtonpaim.Kobi.Overlay`) move a janela, mantém "acima" e "em todas as áreas de trabalho", decide quem recebe o mouse e informa os monitores.

Ambiente de referência: Fedora 44, GNOME 50, três monitores (DisplayLink 100 Hz, notebook 60 Hz, HDMI 100 Hz) desalinhados. Os detalhes, as tabelas completas e o passo a passo dos testes ficam na spec 0002.

### O que o spike respondeu

| Hipótese | Resultado |
|---|---|
| 1. Fundo transparente, sem borda nem sombra | sim, nas duas |
| 2. Por cima de maximizadas, troca de área de trabalho, Visão geral e tela cheia | sim, nas duas, com uma diferença na Visão geral: na A o Kobi some; na B vira miniatura ao lado das janelas |
| 3. Clique atravessa fora do corpo, sem atraso | sim, nas duas (na B depois da extensão versão 3, que decide o mouse no compositor) |
| 4. Travessia entre monitores sem salto nem queda | sim, nas duas (no máximo um quadro perdido na travessia) |
| 5. Renderização não pausa sem foco | sim, nas duas |
| 6. Reage a hotplug, escala e disposição sem reiniciar | sim na B; na A, falha com escala fracionária (abaixo) |

### Comparação

| | A — XWayland | B — Wayland + extensão |
|---|---|---|
| Instalação | nada além do app | o usuário precisa instalar e ativar a extensão |
| Escala fracionária (125% + 100%) | **quebra:** o XWayland inteiro vai a 2×, o Kobi encolhe à metade em todos os monitores e o GNOME o leva ao centro de outro monitor a cada mudança de escala; custo quase dobra nos monitores de 100% | ok: tamanho certo e nítido em cada monitor; continua no lugar ao mudar a escala |
| CPU do Kobi, parado (100 Hz / 60 Hz) | 37–40% / 26% de um núcleo | 35–36% / 24% |
| CPU em movimento (Kobi; gnome-shell + Xwayland) | 41,6%; 23,8% | 35,9%; 17,6% |
| Só o notebook (60 Hz) | 22% parado, 0 quadro perdido | 23% parado; 2 quadros perdidos em 15 s parado e 6 em 63 s de passeio |
| GPU e fluidez | iguais: taxa cheia de cada monitor | iguais |
| Memória | ~300 MiB, estável | ~305 MiB parado; em movimento contínuo sobe ~60 MiB e estabiliza |
| Hotplug | o GNOME leva o Kobi ao monitor que sobra; ao reconectar, ele fica lá | o GNOME leva ao monitor que sobra e, ao reconectar, devolve ao lugar de antes |
| Monitores | ids numéricos do X11; principal e área útil corretos | conectores (`eDP-1`…), principal, área útil e taxa vindos da extensão (o Electron no Wayland não os conhece) |
| Visão geral | some (janela `dock`) | miniatura, como as outras janelas |
| Futuro | depende do XWayland, que o GNOME pode deixar de iniciar por padrão | depende da API interna do GNOME Shell: a extensão precisa acompanhar cada versão |

## Decisão
1. **No GNOME Wayland, a estratégia padrão é a B** (Wayland nativo + extensão GNOME). Pesam a escala fracionária, comum em notebooks e monitores 4K e quebrada na A, o menor custo em movimento e a integração com o GNOME: hotplug, Visão geral e dados corretos dos monitores.
2. **A estratégia A é a alternativa automática** quando a extensão não está instalada, está desativada ou é de uma versão incompatível. O app abre via XWayland, funciona por inteiro e **avisa o usuário** do que falta, com o link para instalar a extensão. É a degradação graciosa do princípio 7 da spec 0002. Escolher a estratégia é trabalho do app, sem variável de ambiente: `KOBI_OVERLAY` fica só para desenvolvimento e medição.
3. **Sessões X11 puras** usam o adaptador da A diretamente. Ele não depende do XWayland, só do protocolo X11. As regras do Mutter medidas (só `dock` anda livre) podem não valer em outros gerenciadores de janelas, então cada um precisa ser testado.
4. **Outros compositores Wayland** (KDE Plasma, wlroots/Sway, Hyprland…) ganham um adaptador próprio com o protocolo **layer-shell** (decisão já registrada em `docs/decisoes.md`); até lá, usam a A via XWayland. Ficam para a Fase 8.
5. **Taxa de quadros: teto de 60 fps por padrão**, com a opção de acompanhar a taxa do monitor. 100 Hz custa ~50% a mais de CPU e ~65% a mais de GPU que 60 Hz, e `docs/performance.md` já prevê 60 fps como padrão. A animação continua independente da taxa (calculada pelo tempo), então o teto não muda velocidades.
6. **O que é regra continua no domínio e na aplicação:** manter o Kobi visível, o resgate, o deslizamento e o soltar valem para qualquer estratégia e qualquer plataforma. O GNOME já move a janela no hotplug, mas o resgate do app continua sendo a garantia: vale para os vãos entre monitores, as outras plataformas e o que o compositor não fizer.

## Consequências
- **Extensão como parte do produto:** precisa de versão para cada GNOME suportado (hoje `shell-version` é só `50`), publicação no site de extensões (Fase 8) e um aviso claro no app quando falta. A versão da interface D-Bus já é negociada (`EXTENSION_VERSIONS`): uma extensão antiga cai no modo possível, nunca numa falha.
- **Segurança:** a extensão age só sobre a janela com o app_id do Kobi e do mesmo processo que chamou (PID do remetente D-Bus). Toda nova chamada precisa manter essa regra.
- **Código:** o `platform.ts` do spike vira produção na Fase 2. Detectar a sessão (GNOME Wayland, outro Wayland, X11) e a extensão; escolher B, A ou X11; avisar o usuário com texto do i18n. `scripts/start.mjs` deixa de impor `x11` por padrão.
- **Pendências da B:**
  - teste de longa duração da memória em movimento (dias aberto, Fase 2);
  - reduzir as chamadas D-Bus por movimento, se esse teste mostrar crescimento;
  - esconder em tela cheia por evento da extensão (`in-fullscreen-changed`, Fase 2).
- **Pendências da A (como alternativa):**
  - corrigir o tamanho e a posição sob escala fracionária, ou avisar o usuário de que ela não é suportada sem a extensão;
  - verificar o foco de teclado em janela `dock`, necessário para o modo texto.
- **Custo de CPU parado acima do espírito da meta:** 22–40% de um núcleo (1,4–2,5% da máquina) só para flutuar, parecido nas duas estratégias. Não decide a estratégia, mas precisa de trabalho na Fase 2:
  - desenhar o WebGL direto no canvas visível;
  - rever supersampling 3× somado ao MSAA;
  - usar uma taxa menor quando só a flutuação se move.

  `docs/performance.md` precisa dizer se "< 5%" é da máquina ou de um núcleo.
- **Casos da matriz não testados fisicamente:**
  - disposição empilhada e coordenadas negativas (cobertas pelos testes do domínio);
  - 4 ou mais monitores e 4K a 200%;
  - outras GPUs e drivers;
  - GNOME anterior ao 50.

  Ficam para a Fase 8 e para a comunidade.
- **Outras plataformas:** o spike confirmou que as portas bastam. Windows e macOS entram como novos adaptadores de `PlatformOverlay` e `DisplaySource`, sem mudar o domínio nem a aplicação. Lições que valem para eles:
  - medir o que o sistema faz sozinho no hotplug;
  - separar a região de entrada do desenho;
  - ler a posição real da janela no processo principal;
  - não confiar no que o toolkit informa sobre os monitores sem conferir.
