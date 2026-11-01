#!/usr/bin/env bash
set -Eeuo pipefail

repository=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repository"

test -f ycoj-ui/.next/standalone/server.js
test -d ycoj-ui/.next/static
test -d ycoj-ui/public

release_id="$(git rev-parse HEAD)-$(date -u +%Y%m%d%H%M%S)-${RANDOM}"
staging=$(mktemp -d)
trap 'rm -rf -- "$staging"' EXIT
mkdir -p .build "$staging/.next/static/deployments" "$staging/public"
cp -a ycoj-ui/.next/standalone/. "$staging/"
cp -a ycoj-ui/public/. "$staging/public/"
cp -a ycoj-ui/.next/static/. "$staging/.next/static/"
cp .cnb/ecosystem.config.cjs .cnb/activate-ui.sh "$staging/"

# Starry Night resolves this WASM asset dynamically at runtime. Validate the
# physical pnpm path used by the build, not just the browser's public copy.
wasm_path=$(cd ycoj-ui && node -e '
  const path = require("node:path");
  const wasm = path.join(path.dirname(require.resolve("vscode-oniguruma")), "onig.wasm");
  console.log(path.relative(process.cwd(), wasm).split(path.sep).join("/"));
')
if [[ ! -f "$staging/$wasm_path" ]]; then
  echo "Standalone release is missing syntax highlighting WASM: $wasm_path" >&2
  exit 1
fi
node -e 'new WebAssembly.Module(require("node:fs").readFileSync(process.argv[1]))' "$staging/$wasm_path"

# Runtime secrets belong on the server, outside the release archive.
find "$staging" -name '.env*' \( -type f -o -type l \) -delete
printf '%s\n' "$release_id" > "$staging/.next/static/deployments/$release_id.txt"
printf '%s\n' "$release_id" > .build/ui-release-id
tar -czf .build/ui-release.tar.gz -C "$staging" .
(cd .build && sha256sum ui-release.tar.gz > ui-release.tar.gz.sha256)
echo "Packaged UI release $release_id"
