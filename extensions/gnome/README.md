# Extensão GNOME do Kobi

No Wayland, um app comum não escolhe onde a própria janela fica nem se ela fica acima das outras: só o compositor decide. Esta extensão faz isso pela janela do Kobi (estratégia B da spec `docs/specs/0002-spike-overlay-linux.md`). O 3D continua todo no app.

Licença **GPL-2.0-or-later** (arquivo `LICENSE` nesta pasta), separada do resto do projeto, que é MIT (ADR 0001).

## O que ela faz

- Mantém a janela do Kobi acima das outras e em todas as áreas de trabalho.
- Move a janela para qualquer posição, sem as restrições de janela comum. Quem garante que o Kobi não some da tela é o app (`keepOnScreen`, no domínio).
- Informa a posição global do ponteiro e avisa quando ele entra ou sai da região interativa do Kobi, para o clique atravessar no resto da janela.

## Privacidade e segurança

- Só age sobre a janela com app_id `io.github.wellingtonpaim.Kobi` **e** que pertence ao mesmo processo que fez a chamada D-Bus. Nunca toca em outras janelas.
- O aviso de ponteiro (`PointerInside`) é enviado só para o Kobi, não para todo o barramento, e diz apenas "dentro" ou "fora".
- Sem polling: reage a chamadas do app e a eventos do compositor (`CursorTracker`) enquanto o Kobi estiver aberto.

## Interface D-Bus

Nome e interface `io.github.wellingtonpaim.Kobi.Overlay`, objeto `/io/github/wellingtonpaim/Kobi/Overlay`, barramento da sessão. Métodos `MoveTo`, `GetFrame`, `GetPointer` e `SetInteractiveRegion`, sinal `PointerInside` e propriedade `Version` (o app só usa versões que conhece). Detalhes em `extension.js`.

## Desenvolvimento

- `dev/nested-session.sh`: sessão GNOME aninhada e isolada (dconf, extensões e D-Bus próprios), com a extensão carregada direto desta pasta. Por padrão abre a janela do devkit com dois monitores virtuais; `KOBI_NESTED_MODE=headless` roda sem janela e `KOBI_NESTED_MONITORS="1920x1080 3840x2160"` escolhe os monitores. Para abrir o Kobi dentro dela: `source "$XDG_RUNTIME_DIR/kobi-nested/env" && KOBI_OVERLAY=wayland pnpm --filter @kobi/desktop start`.
- `dev/interaction-test.sh`: teste automático de ponta a ponta na sessão aninhada headless, com um ponteiro virtual: clique atravessando, clique no corpo, arraste e arremesso. Rode `pnpm --filter @kobi/desktop build` antes.
- `dev/unsafe-mode@kobi.dev/`: extensão **só de testes**, carregada apenas na sessão aninhada, que libera `Eval` e capturas de tela para o teste automático. Nunca instale numa sessão real.
- `region.js` concentra as regras puras, testadas com o Vitest (`test/`).

GNOME 50 (módulos ES). Versões anteriores ainda não foram testadas.
