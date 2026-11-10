#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/dist"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Publish only the static application. Backend code, backups, dependencies,
# SQL migrations, documentation, and development scripts stay out of Pages.
cp "$ROOT_DIR"/*.html "$OUTPUT_DIR"/
cp "$ROOT_DIR"/*.png "$OUTPUT_DIR"/
cp -R "$ROOT_DIR/css" "$ROOT_DIR/js" "$ROOT_DIR/assets" "$OUTPUT_DIR"/
cp "$ROOT_DIR/_headers" "$ROOT_DIR/_redirects" "$OUTPUT_DIR"/
