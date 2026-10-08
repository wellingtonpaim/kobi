#!/usr/bin/env bash
# Instala a extensão do Kobi na sessão GNOME do usuário, no mesmo formato do site de
# extensões (só extension.js, region.js, metadata.json e LICENSE; nada de dev/ ou test/).
# No Wayland o GNOME só carrega extensões novas depois de sair e entrar de novo.
#
#   extensions/gnome/dev/install.sh            # instala (ou atualiza) e ativa
#   extensions/gnome/dev/install.sh --remove   # desativa e remove
set -euo pipefail

extension_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
uuid="$(sed -n 's/.*"uuid": *"\([^"]*\)".*/\1/p' "$extension_dir/metadata.json")"

if [ "${1:-}" = --remove ]; then
  gnome-extensions disable "$uuid" 2> /dev/null || true
  gnome-extensions uninstall "$uuid"
  echo "Extensão $uuid removida."
  exit 0
fi

out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
gnome-extensions pack "$extension_dir" --force --out-dir "$out" \
  --extra-source=region.js --extra-source=LICENSE
gnome-extensions install --force "$out/$uuid.shell-extension.zip"

if gnome-extensions enable "$uuid" 2> /dev/null; then
  echo "Extensão $uuid instalada e ativa."
else
  # O Shell ainda não conhece a extensão: fica marcada para ativar no próximo login.
  current="$(gsettings get org.gnome.shell enabled-extensions)"
  case "$current" in
    *"'$uuid'"*) ;;
    "@as []" | "[]") gsettings set org.gnome.shell enabled-extensions "['$uuid']" ;;
    *) gsettings set org.gnome.shell enabled-extensions "${current%]}, '$uuid']" ;;
  esac
  echo "Extensão $uuid instalada. Saia e entre de novo no GNOME para ela carregar."
fi
