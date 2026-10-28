#!/usr/bin/env bash
# Copies Garden Plot into Shepherd (the bishop_flow repo):
#   src/lib/garden-plot/            the game (TypeScript, CSS, sprite) for the app
#   server/vendor/garden-plot.cjs   the puzzle checker for the API
#
# Usage: npm run export:shepherd -- ../bishop_flow
# Then commit the result in bishop_flow. Shepherd never edits these files.
set -euo pipefail

dest="${1:?usage: export-to-shepherd.sh <path to bishop_flow>}"
dest="$(cd "$dest" && pwd)"
[ -f "$dest/server/index.cjs" ] || { echo "$dest doesn't look like bishop_flow" >&2; exit 1; }
cd "$(dirname "$0")/.."

npm run --silent build:server >/dev/null
rev="$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- src || echo '+changes')"
note="Generated from garden-plot@$rev by scripts/export-to-shepherd.sh. Don't edit: change garden-plot and re-export."

app="$dest/src/lib/garden-plot"
rm -rf "$app"
mkdir -p "$app/assets" "$dest/server/vendor"
for f in index game puzzle explain sounds rng; do
  { echo "// $note"; cat "src/$f.ts"; } > "$app/$f.ts"
done
{ echo "/* $note */"; cat src/styles.css; } > "$app/styles.css"
cp src/assets/trees.png "$app/assets/trees.png"
{ echo "// $note"; cat dist-server/garden-plot.cjs; } > "$dest/server/vendor/garden-plot.cjs"

echo "Exported garden-plot@$rev to $dest"
