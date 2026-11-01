#!/usr/bin/env bash
set -Eeuo pipefail

repository=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
fixture=$(mktemp -d /tmp/ycoj-upload-XXXXXX)
trap 'rm -rf -- "$fixture"' EXIT
mkdir -p "$fixture/bin" "$fixture/repo/.cnb" "$fixture/repo/.build"
cp "$repository/.cnb/deploy-ui.sh" "$repository/.cnb/package-ui.sh" \
  "$repository/.cnb/ecosystem.config.cjs" "$repository/.cnb/activate-ui.sh" "$fixture/repo/.cnb/"
export PATH="$fixture/bin:$PATH"
export TRANSFER_LOG="$fixture/transfer.log"
export LOCAL_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
export REMOTE_SHA="$LOCAL_SHA"
export DEPLOY_HOST=example.com DEPLOY_USER=deploy DEPLOY_PORT=2222
export DEPLOY_SSH_KEY=test-private-key DEPLOY_KNOWN_HOSTS=test-known-host
export DEPLOY_ROOT=/srv/ycoj-ui DEPLOY_ACTIVATE=false

cat > "$fixture/bin/git" <<'MOCK'
#!/usr/bin/env bash
case "$1" in
  rev-parse) echo "$LOCAL_SHA" ;;
  ls-remote) printf '%s\trefs/heads/master\n' "$REMOTE_SHA" ;;
  *) exit 1 ;;
esac
MOCK
for command in ssh scp; do
  cat > "$fixture/bin/$command" <<'MOCK'
#!/usr/bin/env bash
echo "$(basename "$0") $*" >> "$TRANSFER_LOG"
[[ "${FAIL_TRANSFER:-false}" = false ]]
MOCK
done
chmod +x "$fixture/bin/"*

# Package a traced public directory as well as the full public tree, checking
# that the copy merges directories rather than creating public/public.
cd "$fixture/repo"
mkdir -p ycoj-ui/.next/standalone/public ycoj-ui/.next/static ycoj-ui/public/vendor
touch ycoj-ui/.next/standalone/server.js
echo secret > ycoj-ui/.next/standalone/.env.production
echo traced > ycoj-ui/.next/standalone/public/traced.txt
echo asset > ycoj-ui/public/vendor/asset.js
echo chunk > ycoj-ui/.next/static/chunk.js
wasm_package=node_modules/.pnpm/vscode-oniguruma@2.0.1/node_modules/vscode-oniguruma
mkdir -p "ycoj-ui/$wasm_package/release" "ycoj-ui/.next/standalone/$wasm_package/release" ycoj-ui/node_modules
printf '{"main":"release/main.js"}\n' > "ycoj-ui/$wasm_package/package.json"
touch "ycoj-ui/$wasm_package/release/main.js"
# Use a real module-resolution path, including pnpm's nested layout.
node -e 'require("node:fs").symlinkSync(require("node:path").resolve(process.argv[1]), process.argv[2], "junction")' \
  "ycoj-ui/$wasm_package" ycoj-ui/node_modules/vscode-oniguruma
printf '\000asm\001\000\000\000' > "ycoj-ui/.next/standalone/$wasm_package/release/onig.wasm"
bash .cnb/package-ui.sh
release_id=$(cat .build/ui-release-id)
tar -tzf .build/ui-release.tar.gz > "$fixture/contents"
grep -x './public/vendor/asset.js' "$fixture/contents"
grep -x './public/traced.txt' "$fixture/contents"
grep -x './.next/static/chunk.js' "$fixture/contents"
grep -x "./.next/static/deployments/$release_id.txt" "$fixture/contents"
grep -x "./$wasm_package/release/onig.wasm" "$fixture/contents"
if grep -E '/\.env|/public/public/' "$fixture/contents"; then
  echo 'Unexpected environment file or nested public directory in release' >&2
  exit 1
fi
echo 'PASS: package contains generated assets and release marker without env secrets'

mv "ycoj-ui/.next/standalone/$wasm_package/release/onig.wasm" "$fixture/onig.wasm"
if bash .cnb/package-ui.sh; then echo 'Expected missing WASM failure' >&2; exit 1; fi
mv "$fixture/onig.wasm" "ycoj-ui/.next/standalone/$wasm_package/release/onig.wasm"
echo 'PASS: missing server-side highlighter WASM prevents publishing'

: > "$TRANSFER_LOG"
bash .cnb/deploy-ui.sh
[[ "$(grep -c '^ssh ' "$TRANSFER_LOG")" = 2 ]]
[[ "$(grep -c '^scp ' "$TRANSFER_LOG")" = 1 ]]
grep -q StrictHostKeyChecking=yes "$TRANSFER_LOG"
grep -q -- '-P 2222' "$TRANSFER_LOG"
if grep -q 'bash -lc' "$TRANSFER_LOG"; then exit 1; fi
echo 'PASS: upload-only mode verifies SSH host and does not activate PM2'

: > "$TRANSFER_LOG"
export DEPLOY_ACTIVATE=true
bash .cnb/deploy-ui.sh
[[ "$(grep -c '^ssh ' "$TRANSFER_LOG")" = 3 ]]
grep -q 'bash -lc' "$TRANSFER_LOG"
echo 'PASS: automatic mode invokes the uploaded activation script'

: > "$TRANSFER_LOG"
export REMOTE_SHA=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
bash .cnb/deploy-ui.sh
[[ ! -s "$TRANSFER_LOG" ]]
echo 'PASS: outdated build cannot upload or activate'
export REMOTE_SHA="$LOCAL_SHA"

: > "$TRANSFER_LOG"
export FAIL_TRANSFER=true
if bash .cnb/deploy-ui.sh; then echo 'Expected SSH failure' >&2; exit 1; fi
[[ "$(wc -l < "$TRANSFER_LOG")" = 1 ]]
echo 'PASS: failed SSH preparation prevents upload and activation'
unset FAIL_TRANSFER

: > "$TRANSFER_LOG"
echo corruption >> .build/ui-release.tar.gz
if bash .cnb/deploy-ui.sh; then echo 'Expected archive checksum failure' >&2; exit 1; fi
[[ ! -s "$TRANSFER_LOG" ]]
echo 'PASS: corrupt archive cannot reach the server'
