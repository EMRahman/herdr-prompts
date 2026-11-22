#!/usr/bin/env bash
set -e

TARGET_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}/mods/prompts"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/mods/prompts"

echo "Installing Prompts mod to: $TARGET_DIR"
mkdir -p "$TARGET_DIR"

cp "$SOURCE_DIR/mod.json" "$TARGET_DIR/mod.json"
cp "$SOURCE_DIR/main.js" "$TARGET_DIR/main.js"

echo "Checking mod with herdr-app check..."
HERDR_APP_BIN="${HOME}/.local/bin/herdr-app"
if [ -x "$HERDR_APP_BIN" ]; then
  "$HERDR_APP_BIN" check "$TARGET_DIR"
fi

echo "Done!"
