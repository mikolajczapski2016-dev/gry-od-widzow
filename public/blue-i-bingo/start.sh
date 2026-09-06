#!/usr/bin/env bash
set -e
GAME_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if command -v google-chrome >/dev/null 2>&1; then
  exec google-chrome --app="file://$GAME_DIR/index.html" --start-maximized
else
  exec xdg-open "$GAME_DIR/index.html"
fi
