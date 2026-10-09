# Extensão GNOME do Kobi

No Wayland, um app comum não escolhe onde a própria janela fica nem se ela fica acima das outras: só o compositor decide. Esta extensão faz isso pela janela do Kobi (estratégia B da spec `docs/specs/0002-spike-overlay-linux.md`). O 3D continua todo no app.

Licença **GPL-2.0-or-later** (arquivo `LICENSE` nesta pasta), separada do resto do projeto, que é MIT (ADR 0001).

## O que ela faz

- Mantém a janela do Kobi acima das outras e em todas as áreas de trabalho.
- Move a janela para qualquer posição, sem as restrições de janela comum. Quem garante que o Kobi não some da tela é o app (`keepOnScreen`, no domínio).
- Faz o clique atravessar fora do corpo do Kobi: o compositor só entrega o mouse à janela dele quando o ponteiro está sobre o corpo (ou durante um arraste que começou nele). Também informa a posição global do ponteiro.
- Informa os monitores como o GNOME os vê (monitor principal, área útil sem o painel, escala e taxa de atualização), que o Electron não conhece no Wayland, e avisa quando eles mudam.

## Privacidade e segurança

- Só age sobre a janela com app_id `io.github.wellingtonpaim.Kobi` **e** que pertence ao mesmo processo que fez a chamada D-Bus. Nunca toca em outras janelas.
- O aviso de ponteiro (`PointerInside`) é enviado só para o Kobi, não para todo o barramento, e diz apenas "dentro" ou "fora".
- Sem polling: reage a chamadas do app e a eventos do compositor (`CursorTracker`) enquanto o Kobi estiver aberto.

## Interface D-Bus

Nome e interface `io.github.wellingtonpaim.Kobi.Overlay`, objeto `/io/github/wellingtonpaim/Kobi/Overlay`, barramento da sessão. Métodos `MoveTo`, `GetFrame`, `GetPointer`, `SetInteractiveRegion` e `GetMonitors`, sinais `PointerInside` e `MonitorsChanged` e propriedade `Version` (1: janela e ponteiro; 2: monitores; 3: a extensão decide quem recebe o mouse). O app usa o que a versão instalada oferece. Detalhes em `extension.js`.

## Instalar na sua sessão

`extensions/gnome/dev/install.sh` empacota e instala a extensão no formato do site de extensões (só os arquivos de produção) e a deixa ativa. No Wayland o GNOME só carrega extensões novas depois de **sair e entrar de novo**. Para remover: `extensions/gnome/dev/install.sh --remove`.

## Desenvolvimento

- `dev/nested-session.sh`: sessão GNOME aninhada e isolada (dconf, extensões e D-Bus próprios), com a extensão carregada direto desta pasta. Por padrão abre a janela do devkit com dois monitores virtuais; `KOBI_NESTED_MODE=headless` roda sem janela e `KOBI_NESTED_MONITORS="1920x1080 3840x2160"` escolhe os monitores. Para abrir o Kobi dentro dela: `source "$XDG_RUNTIME_DIR/kobi-nested/env" && KOBI_OVERLAY=wayland pnpm --filter @kobi/desktop start`.
- `dev/interaction-test.sh`: teste automático de ponta a ponta na sessão aninhada headless, com um ponteiro virtual: clique atravessando, clique no corpo, arraste e arremesso. Rode `pnpm --filter @kobi/desktop build` antes.
- `dev/unsafe-mode@kobi.dev/`: extensão **só de testes**, carregada apenas na sessão aninhada, que libera `Eval` e capturas de tela para o teste automático. Nunca instale numa sessão real.
- `region.js` e `monitors.js` concentram as regras puras, testadas com o Vitest (`test/`).

GNOME 50 (módulos ES). Versões anteriores ainda não foram testadas.
