#!/usr/bin/env bash
# Teste de interação do overlay (spec 0002) numa sessão GNOME aninhada e isolada:
# clique atravessando, clique no corpo, arraste e arremesso, com um ponteiro virtual.
# Não aparece na tela nem toca na sessão real. Rode `pnpm --filter @kobi/desktop build` antes.
#
#   extensions/gnome/dev/interaction-test.sh          # estratégia B (Wayland + extensão)
#   KOBI_OVERLAY=x11 extensions/gnome/dev/interaction-test.sh   # estratégia A (XWayland)
set -uo pipefail
strategy="${KOBI_OVERLAY:-wayland}"

dev_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$dev_dir/../../.." && pwd)"
root="${XDG_RUNTIME_DIR:?}/kobi-nested"
work="$(mktemp -d)"
failures=0

stop_nested() {
  for pid in $(pgrep -x gnome-shell); do
    tr '\0' ' ' < "/proc/$pid/cmdline" | grep -q wayland-kobi && kill "$pid"
  done
}
cleanup() {
  [ -n "${kobi_pid:-}" ] && kill "$kobi_pid" 2> /dev/null
  [ -n "${behind_pid:-}" ] && kill "$behind_pid" 2> /dev/null
  stop_nested
  rm -rf "$work"
}
trap cleanup EXIT

stop_nested
sleep 1
touch "$work/started"
KOBI_NESTED_X11=$([ "$strategy" = x11 ] && echo 1 || echo 0) \
  KOBI_NESTED_MODE=headless KOBI_NESTED_MONITORS="1920x1080@60 1920x1200@100" \
  setsid "$dev_dir/nested-session.sh" > "$work/nested.log" 2>&1 < /dev/null &
for _ in $(seq 1 60); do
  sleep 0.5
  grep -q "GNOME Shell started" "$work/nested.log" 2> /dev/null && [ -f "$root/env" ] && break
done
# shellcheck disable=SC1091
source "$root/env"

shell_eval() {
  gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
    --method org.gnome.Shell.Eval "$1" | sed -E "s/^\(true, '\"?(.*)\"?'\)$/\1/; s/\"$//"
}
pointer() {
  local action
  case "$1" in
    move) action="p.notify_absolute_motion(t, $2, $3);" ;;
    press) action="p.notify_button(t, Clutter.BUTTON_PRIMARY, Clutter.ButtonState.PRESSED);" ;;
    release) action="p.notify_button(t, Clutter.BUTTON_PRIMARY, Clutter.ButtonState.RELEASED);" ;;
    # Arremesso como um mouse de verdade: de (x, y), dx pixels em passos de 8 ms
    # (125 Hz), soltando logo depois do último movimento, tudo dentro do Shell.
    fling) action="let i = 0; GLib.timeout_add(GLib.PRIORITY_HIGH, 8, () => {
        i += 1;
        const now = GLib.get_monotonic_time();
        p.notify_absolute_motion(now, $2 + ($4 * i) / $5, $3);
        if (i < $5) return GLib.SOURCE_CONTINUE;
        p.notify_button(now + 1000, Clutter.BUTTON_PRIMARY, Clutter.ButtonState.RELEASED);
        return GLib.SOURCE_REMOVE;
      });" ;;
  esac
  shell_eval "const Clutter = imports.gi.Clutter, GLib = imports.gi.GLib;
    global._kobiPointer ??= Clutter.get_default_backend().get_default_seat()
      .create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
    const p = global._kobiPointer, t = GLib.get_monotonic_time(); $action 'ok'" > /dev/null
}
# Salta direto para o ponto e clica parado: o caso mais exigente para a troca de quem
# recebe o mouse (um mouse real manda vários movimentos no caminho).
click() {
  pointer move "$1" "$2"; sleep 0.3
  pointer press; sleep 0.05; pointer release; sleep 0.4
}
kobi_frame() {
  shell_eval "const w = global.get_window_actors().map(a => a.get_meta_window())
    .find(w => w.get_wm_class() === 'io.github.wellingtonpaim.Kobi');
    w ? [w.get_frame_rect().x, w.get_frame_rect().y].join(',') : 'none'"
}
behind_clicks() { grep -c BEHIND "$work/behind.out" || true; }
check() {
  if [ "$2" = "$3" ]; then echo "PASSOU  $1"; else echo "FALHOU  $1 (esperado $3, obtido $2)"; failures=$((failures + 1)); fi
}

python3 -I -u "$dev_dir/behind-window.py" > "$work/behind.out" 2> /dev/null &
behind_pid=$!
sleep 2
if [ "$strategy" = x11 ]; then
  # O XWayland da sessão aninhada sobe sob demanda; o número do display sai no log.
  # O XWayland aninhado tem cookie próprio: só vale o criado depois de a sessão começar.
  export DISPLAY="$(grep -oE 'X11 display :[0-9]+' "$work/nested.log" | tail -1 | grep -oE ':[0-9]+')"
  export XAUTHORITY="$(find "$XDG_RUNTIME_DIR" -maxdepth 1 -name '.mutter-Xwaylandauth.*' -newer "$work/started" | head -1)"
  expected_overlay="overlay: x11"
else
  expected_overlay="overlay: gnome-wayland"
fi
(cd "$repo/apps/desktop" && env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron . \
  --ozone-platform="$strategy" > "$work/kobi.log" 2>&1) &
kobi_pid=$!
sleep 7
shell_eval "Main.overview.hide(); 'ok'" > /dev/null
sleep 1
# Os primeiros cliques depois de a sessão abrir se perdem, com ou sem o Kobi.
for x in 1660 1670 1680; do click "$x" 1000; done
base=$(behind_clicks)

check "estratégia escolhida" "$(grep -o 'overlay: [a-z0-9-]*' "$work/kobi.log")" "$expected_overlay"
if [ "$strategy" = wayland ]; then
  # Com a extensão, os monitores vêm do GNOME: ids são conectores, com taxa real (100 Hz).
  check "monitores lidos do GNOME" \
    "$(grep -o 'principal: [A-Za-z0-9-]*' "$work/kobi.log" | grep -q 'principal: Meta-' && grep -q '100 Hz' "$work/kobi.log" && echo sim || echo "não: $(grep monitores "$work/kobi.log")")" "sim"
fi
check "janela acima e em todas as áreas de trabalho" \
  "$(shell_eval "const w = global.get_window_actors().map(a => a.get_meta_window()).find(w => w.get_wm_class() === 'io.github.wellingtonpaim.Kobi'); String(w.is_above() && w.is_on_all_workspaces())")" "true"
# Canto inferior direito da área útil do principal (1920×1200 à esquerda), margem de 24 px,
# medido pela silhueta do Kobi.
start="$(kobi_frame)"
check "posição inicial (canto inferior direito do principal)" \
  "$(awk -F, '{ print ($1 > 1400 && $1 < 1700 && $2 > 600 && $2 < 900) ? "sim" : "não (" $0 ")" }' <<< "$start")" "sim"

sx="${start%%,*}"; sy="${start##*,}"
# Pontos relativos à janela: um canto transparente e o meio do corpo do Kobi.
click $((sx + 10)) $((sy + 14))
check "clique na área transparente vai para a janela de trás" "$(($(behind_clicks) - base))" "1"
click $((sx + 150)) $((sy + 204))
check "clique no corpo fica com o Kobi" "$(($(behind_clicks) - base))" "1"
# Depois de passar pelo corpo, a área transparente volta a deixar o clique passar
# (achado do Wellington: antes, só voltava ao sair da janela inteira).
pointer move $((sx + 150)) $((sy + 204)); sleep 0.4
click $((sx + 12)) $((sy + 16))
check "depois de passar pelo corpo, a área transparente deixa o clique passar" "$(($(behind_clicks) - base))" "2"

bx=$((sx + 150)); by=$((sy + 204))
pointer move "$bx" "$by"; sleep 0.3; pointer press; sleep 0.1
for i in $(seq 1 20); do pointer move $((bx - i * 15)) $((by - i * 5)); sleep 0.03; done
sleep 0.3; pointer release; sleep 0.5
dragged="$(kobi_frame)"
if [ "$strategy" = x11 ]; then
  # XWayland converte o ponteiro com a posição da janela X11 que ele conhece, que chega
  # atrasada quando a janela anda junto com o ponteiro: o soltar pode vir com até um
  # passo de movimento de diferença (aqui, 15 px). Na estratégia B a posição é exata.
  check "arrastar −300,−100 e soltar parado (±20 px no XWayland)" \
    "$(awk -F, -v x=$((sx - 300)) -v y=$((sy - 100)) '{ dx = $1 - x; dy = $2 - y; print (dx * dx <= 400 && dy * dy <= 400) ? "sim" : "não (" $0 ")" }' <<< "$dragged")" "sim"
else
  check "arrastar −300,−100 e soltar parado" "$dragged" "$((sx - 300)),$((sy - 100))"
fi

sleep 1.5
tx=$((bx - 300)); ty=$((by - 100))
pointer move "$tx" "$ty"; sleep 0.3; pointer press; sleep 0.1
pointer fling "$tx" "$ty" 320 12; sleep 3
landed="$(kobi_frame)"
check "arremesso desliza até o outro monitor" "$([ "${landed%%,*}" -gt 1920 ] && echo sim || echo "não ($landed)")" "sim"

# Volta ao monitor principal e troca de área de trabalho: o Kobi vai junto (achado do
# Wellington: o GNOME prende à área ativa a janela que volta ao monitor principal).
lx="${landed%%,*}"; ly="${landed##*,}"
gx=$((lx + 150)); gy=$((ly + 204))
pointer move "$gx" "$gy"; sleep 0.3; pointer press; sleep 0.1
for i in $(seq 1 30); do pointer move $((gx - i * 60)) "$gy"; sleep 0.02; done
sleep 0.3; pointer release; sleep 0.5
shell_eval "global.workspace_manager.append_new_workspace(false, global.get_current_time());
  global.workspace_manager.get_workspace_by_index(1).activate(global.get_current_time()); 'ok'" > /dev/null
sleep 1
check "depois de voltar ao principal, segue o usuário para outra área de trabalho" \
  "$(shell_eval "const w = global.get_window_actors().map(a => a.get_meta_window()).find(w => w.get_wm_class() === 'io.github.wellingtonpaim.Kobi');
    String(w.get_monitor() === global.display.get_primary_monitor() && w.is_on_all_workspaces() && w.get_compositor_private().visible)")" "true"

[ "$failures" -eq 0 ] && echo "Tudo certo." || echo "$failures falha(s)."
exit "$failures"
