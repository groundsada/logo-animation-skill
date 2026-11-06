#!/usr/bin/env bash
set -euo pipefail

NAME="logo-animation"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="link"
[ "${1:-}" = "--copy" ] && MODE="copy"

install_into() {
  local root="$1" label="$2"
  [ -d "$root" ] || { echo "  $label: $root not found, skipping"; return; }
  mkdir -p "$root"
  local dest="$root/$NAME"
  rm -rf "$dest"
  if [ "$MODE" = "link" ]; then
    ln -s "$SRC" "$dest"
    echo "  $label: linked -> $dest"
  else
    mkdir -p "$dest"
    cp -R "$SRC/SKILL.md" "$SRC/README.md" "$SRC/LICENSE" \
      "$SRC/assets" "$SRC/templates" "$SRC/reference" "$SRC/scripts" "$SRC/examples" "$dest/"
    echo "  $label: copied -> $dest"
  fi
}

echo "installing $NAME ($MODE)"
install_into "$HOME/.claude/skills" "claude"
install_into "$HOME/.hermes/skills" "hermes"
install_into "$HOME/.config/opencode/skills" "opencode"

echo
echo "done. check:"
echo "  ls -l ~/.claude/skills/$NAME ~/.hermes/skills/$NAME ~/.config/opencode/skills/$NAME"
