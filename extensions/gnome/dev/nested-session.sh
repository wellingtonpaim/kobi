#!/usr/bin/env bash
# Sessão GNOME aninhada e isolada para desenvolver a extensão sem tocar na sessão real:
# dconf, extensões e barramento D-Bus próprios. A extensão é carregada direto desta pasta.
#
#   extensions/gnome/dev/nested-session.sh                 # janela do devkit, 2 monitores
#   KOBI_NESTED_MODE=headless extensions/gnome/dev/nested-session.sh   # sem janela (testes)
#   KOBI_NESTED_MONITORS="1920x1080 3840x2160" ...          # monitores virtuais
#   KOBI_NESTED_X11=1 ...                                   # com XWayland (estratégia A)
#
# Ao subir, grava em $root/env as variáveis para abrir apps dentro dela:
#   source "$XDG_RUNTIME_DIR/kobi-nested/env" && KOBI_OVERLAY=wayland pnpm --filter @kobi/desktop start
# Para encerrar: kill "$(cat "$XDG_RUNTIME_DIR/kobi-nested/pid")"
set -euo pipefail

extension_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
uuid="$(sed -n 's/.*"uuid": *"\([^"]*\)".*/\1/p' "$extension_dir/metadata.json")"
root="${XDG_RUNTIME_DIR:?}/kobi-nested"
display_name="wayland-kobi"
mode="${KOBI_NESTED_MODE:-devkit}"

rm -rf "$root"
mkdir -p "$root/config" "$root/data/gnome-shell/extensions"
ln -s "$extension_dir" "$root/data/gnome-shell/extensions/$uuid"
# Extensão só de testes (Eval e capturas); existe apenas dentro desta sessão isolada.
dev_uuid="unsafe-mode@kobi.dev"
ln -s "$extension_dir/dev/$dev_uuid" "$root/data/gnome-shell/extensions/$dev_uuid"

monitor_args=()
for monitor in ${KOBI_NESTED_MONITORS:-1920x1080 1920x1080}; do
  monitor_args+=(--virtual-monitor "$monitor")
done
x11_args=(--no-x11)
[ "${KOBI_NESTED_X11:-0}" = 1 ] && x11_args=()
case "$mode" in
  headless) mode_args=(--headless) ;;
  devkit) mode_args=(--devkit) ;;
  *) echo "KOBI_NESTED_MODE inválido: $mode" >&2; exit 1 ;;
esac

export XDG_CONFIG_HOME="$root/config" XDG_DATA_HOME="$root/data"
export KOBI_NESTED_ROOT="$root" KOBI_NESTED_DISPLAY="$display_name"
exec dbus-run-session -- bash -c '
  set -euo pipefail
  dconf write /org/gnome/shell/enabled-extensions "[\"'"$uuid"'\", \"'"$dev_uuid"'\"]"
  dconf write /org/gnome/shell/disable-user-extensions false
  dconf write /org/gnome/shell/welcome-dialog-last-shown-version "\"999\""
  {
    echo "export DBUS_SESSION_BUS_ADDRESS=\"$DBUS_SESSION_BUS_ADDRESS\""
    echo "export WAYLAND_DISPLAY=\"$KOBI_NESTED_DISPLAY\""
    echo "unset DISPLAY"
  } > "$KOBI_NESTED_ROOT/env"
  echo $$ > "$KOBI_NESTED_ROOT/pid"
  exec gnome-shell --wayland --wayland-display "$KOBI_NESTED_DISPLAY" "$@"
' nested "${mode_args[@]}" "${x11_args[@]}" "${monitor_args[@]}"
