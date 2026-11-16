#!/usr/bin/env bash
set -Eeuo pipefail

repository=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
fixture=$(mktemp -d /tmp/ycoj-backend-XXXXXX)
trap 'rm -rf -- "$fixture"' EXIT
mkdir -p "$fixture/bin" "$fixture/upstream"
export BACKEND_TEST_LOG="$fixture/commands.log"
export REAL_NODE
REAL_NODE=$(command -v node)
git init -q -b master "$fixture/upstream"
git -C "$fixture/upstream" config user.name Test
git -C "$fixture/upstream" config user.email test@example.com
echo initial > "$fixture/upstream/source.txt"
cat > "$fixture/upstream/package.json" <<'JSON'
{
    "name": "backend-fixture",
    "private": true,
    "scripts": { "start": "node server.js", "test": "old-tests" },
    "dependencies": { "example": "^1.0.0" }
}
JSON
git -C "$fixture/upstream" add source.txt package.json
git -C "$fixture/upstream" commit -qm initial
base=$(git -C "$fixture/upstream" rev-parse HEAD)
echo next > "$fixture/upstream/source.txt"
"$REAL_NODE" - "$fixture/upstream/package.json" <<'NODE'
const fs = require('node:fs');
const path = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
manifest.scripts.test = 'release-tests';
fs.writeFileSync(path, JSON.stringify(manifest, null, 4) + '\n');
NODE
mkdir -p "$fixture/upstream/.yarn/releases"
echo bundled-yarn > "$fixture/upstream/.yarn/releases/yarn.cjs"
git -C "$fixture/upstream" add .yarn/releases/yarn.cjs
git -C "$fixture/upstream" commit -qam next
target=$(git -C "$fixture/upstream" rev-parse HEAD)
echo future > "$fixture/upstream/source.txt"
git -C "$fixture/upstream" commit -qam future

cat > "$fixture/bin/yarn" <<'MOCK'
#!/usr/bin/env bash
set -eu
echo "yarn $*" >> "$BACKEND_TEST_LOG"
[[ "$*" = install && "${YARN_ENABLE_IMMUTABLE_INSTALLS:-}" = false ]]
[[ "${COREPACK_ENABLE_AUTO_PIN:-}" = 0 ]]
[[ "${FAIL_INSTALL:-false}" = false ]]
MOCK
cat > "$fixture/bin/pm2" <<'MOCK'
#!/usr/bin/env bash
echo "pm2 $*" >> "$BACKEND_TEST_LOG"
if [[ "$1" = jlist ]]; then
  printf '[{"name":"ycoj","pm2_env":{"status":"online"}}]'
fi
MOCK
cat > "$fixture/bin/node" <<'MOCK'
#!/usr/bin/env bash
if [[ "$1" = -r ]]; then
  echo "node $*" >> "$BACKEND_TEST_LOG"
elif [[ "${FAIL_HEALTH:-false}" = true && "$*" = *process.stdin* ]]; then
  cat > /dev/null
else
  exec "$REAL_NODE" "$@"
fi
MOCK
cat > "$fixture/bin/curl" <<'MOCK'
#!/usr/bin/env bash
echo 'curl' >> "$BACKEND_TEST_LOG"
[[ "${FAIL_HEALTH:-false}" = false ]]
MOCK
printf '#!/usr/bin/env bash\nexit 0\n' > "$fixture/bin/sleep"
# Windows has no flock; production uses the real util-linux flock.
printf '#!/usr/bin/env bash\necho flock >> "$BACKEND_TEST_LOG"\n' > "$fixture/bin/flock"
chmod +x "$fixture/bin/"*
export PATH="$fixture/bin:$PATH"

setup() {
  export server="$fixture/$1"
  git clone -q "$fixture/upstream" "$server"
  git -C "$server" reset -q --hard "$base"
  : > "$BACKEND_TEST_LOG"
  unset FAIL_INSTALL FAIL_HEALTH
}
deploy() {
  bash "$repository/.cnb/update-backend.sh" "$server" "$target" ycoj http://127.0.0.1:2333/health
}

rewrite_manifest() {
  "$REAL_NODE" - "$server/package.json" "${1-yarn@4.13.0+sha512.aaaaaaaa}" <<'NODE'
const fs = require('node:fs');
const path = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
if (process.argv[3]) manifest.packageManager = process.argv[3];
fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
NODE
}

expect_manifest_rejection() {
  cp "$server/package.json" "$fixture/rejected-package.json"
  git -C "$server" show :package.json > "$fixture/rejected-index.json"
  if deploy; then echo 'Expected manifest conflict rejection' >&2; exit 1; fi
  cmp "$server/package.json" "$fixture/rejected-package.json"
  git -C "$server" show :package.json > "$fixture/index-after-rejection.json"
  cmp "$fixture/index-after-rejection.json" "$fixture/rejected-index.json"
  [[ ! -e "$server/.git/ycoj-deploy-backups" ]]
  if grep -q '^pm2 restart\|^yarn ' "$BACKEND_TEST_LOG"; then exit 1; fi
}

setup success
echo keep > "$server/config.yaml"
deploy
[[ "$(git -C "$server" rev-parse HEAD)" = "$target" ]]
[[ "$(cat "$server/config.yaml")" = keep ]]
grep -qx 'pm2 restart ycoj' "$BACKEND_TEST_LOG"
grep -qx 'pm2 save' "$BACKEND_TEST_LOG"
[[ "$(grep -c '^yarn ' "$BACKEND_TEST_LOG")" = 1 ]]
echo 'PASS: exact triggering commit is deployed, config preserved, only ycoj restarts, no UI build'

setup matching-changes
echo next > "$server/source.txt"
mkdir -p "$server/.yarn/releases"
echo bundled-yarn > "$server/.yarn/releases/yarn.cjs"
deploy
[[ "$(git -C "$server" rev-parse HEAD)" = "$target" ]]
[[ -z "$(git -C "$server" status --porcelain)" ]]
echo 'PASS: matching tracked fixes and untracked Yarn release are preserved and become clean'

setup corepack-pin
rewrite_manifest
cp "$server/package.json" "$fixture/generated-package.json"
deploy
backups=("$server/.git/ycoj-deploy-backups"/package-json-*)
[[ "${#backups[@]}" = 1 ]]
cmp "$fixture/generated-package.json" "${backups[0]}/package.json"
git -C "$server" show "$base:package.json" > "$fixture/base-package.json"
cmp "$fixture/base-package.json" "${backups[0]}/package.json.index"
[[ -z "$(git -C "$server" status --porcelain)" ]]
deploy
backups=("$server/.git/ycoj-deploy-backups"/package-json-*)
[[ "${#backups[@]}" = 1 ]]
echo 'PASS: Corepack pin and formatting are backed up, normalized and safe to redeploy'

setup staged-corepack-pin
rewrite_manifest yarn@4.13.0
git -C "$server" add package.json
git -C "$server" show :package.json > "$fixture/staged-package.json"
deploy
backups=("$server/.git/ycoj-deploy-backups"/package-json-*)
cmp "$fixture/staged-package.json" "${backups[0]}/package.json.index"
[[ -z "$(git -C "$server" status --porcelain)" ]]
echo 'PASS: staged Corepack metadata is also backed up and normalized'

setup target-corepack-pin
git -C "$server" show "$target:package.json" > "$server/package.json"
rewrite_manifest
deploy
[[ -z "$(git -C "$server" status --porcelain)" ]]
echo 'PASS: a manifest already matching the release plus Corepack metadata can fast-forward'

setup manifest-formatting
rewrite_manifest ''
deploy
[[ -z "$(git -C "$server" status --porcelain)" ]]
echo 'PASS: formatting-only manifest changes can fast-forward'

for section in scripts dependencies; do
  setup "dirty-manifest-$section"
  rewrite_manifest
  "$REAL_NODE" - "$server/package.json" "$section" <<'NODE'
const fs = require('node:fs');
const path = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
manifest[process.argv[3]].local = 'server-customization';
fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
NODE
  expect_manifest_rejection
done
echo 'PASS: local script and dependency changes remain untouched and block deployment'

setup staged-manifest-conflict
rewrite_manifest
"$REAL_NODE" - "$server/package.json" <<'NODE'
const fs = require('node:fs');
const path = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
manifest.dependencies.local = 'staged-customization';
fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
NODE
git -C "$server" add package.json
git -C "$server" show "$base:package.json" > "$server/package.json"
rewrite_manifest
expect_manifest_rejection
echo 'PASS: a generated worktree cannot hide conflicting staged dependency changes'

setup different-package-manager
rewrite_manifest pnpm@10.11.1
expect_manifest_rejection
echo 'PASS: a different package manager is not treated as Corepack Yarn metadata'

setup malformed-manifest
printf '{broken JSON\n' > "$server/package.json"
expect_manifest_rejection
echo 'PASS: malformed manifests are preserved and rejected'

setup conflicting-untracked
mkdir -p "$server/.yarn/releases"
echo server-custom-yarn > "$server/.yarn/releases/yarn.cjs"
if deploy; then echo 'Expected untracked conflict rejection' >&2; exit 1; fi
[[ "$(cat "$server/.yarn/releases/yarn.cjs")" = server-custom-yarn ]]
if grep -q '^pm2 restart\|^yarn ' "$BACKEND_TEST_LOG"; then exit 1; fi
echo 'PASS: conflicting untracked server files are preserved and block deployment'

setup dirty
echo local > "$server/source.txt"
if deploy; then echo 'Expected dirty tree rejection' >&2; exit 1; fi
[[ "$(cat "$server/source.txt")" = local ]]
if grep -q '^pm2 restart\|^yarn ' "$BACKEND_TEST_LOG"; then exit 1; fi
echo 'PASS: tracked server changes prevent update and restart'

setup newer
git -C "$server" reset -q --hard origin/master
newer=$(git -C "$server" rev-parse HEAD)
if deploy; then echo 'Expected newer revision rejection' >&2; exit 1; fi
[[ "$(git -C "$server" rev-parse HEAD)" = "$newer" ]]
if grep -q '^pm2 restart\|^yarn ' "$BACKEND_TEST_LOG"; then exit 1; fi
echo 'PASS: a newer server commit cannot be downgraded'

setup install-failure
export FAIL_INSTALL=true
if deploy; then echo 'Expected install failure' >&2; exit 1; fi
if grep -q '^pm2 restart' "$BACKEND_TEST_LOG"; then exit 1; fi
echo 'PASS: dependency install failure prevents restart'

setup health-failure
export FAIL_HEALTH=true
if deploy; then echo 'Expected health failure' >&2; exit 1; fi
[[ "$(grep -c '^curl$' "$BACKEND_TEST_LOG")" = 30 ]]
if grep -qx 'pm2 save' "$BACKEND_TEST_LOG"; then exit 1; fi
echo 'PASS: unhealthy backend fails deployment instead of saving success'

mkdir -p "$fixture/runner/.cnb"
cp "$repository/.cnb/deploy-backend.sh" "$repository/.cnb/update-backend.sh" "$fixture/runner/.cnb/"
export RUNNER_SHA="$target" REMOTE_SHA="$target"
export DEPLOY_HOST=example.com DEPLOY_USER=deploy DEPLOY_PORT=2222
export DEPLOY_SSH_KEY=test-key DEPLOY_KNOWN_HOSTS=test-host
export BACKEND_BASEURL=http://127.0.0.1:2333
unset DEPLOY_BACKEND_ROOT DEPLOY_BACKEND_PM2_NAME DEPLOY_BACKEND_HEALTH_URL
cat > "$fixture/bin/git" <<'MOCK'
#!/usr/bin/env bash
case "$1" in
  rev-parse) echo "$RUNNER_SHA" ;;
  ls-remote) printf '%s\trefs/heads/master\n' "$REMOTE_SHA" ;;
  *) exit 1 ;;
esac
MOCK
cat > "$fixture/bin/ssh" <<'MOCK'
#!/usr/bin/env bash
echo "ssh $*" >> "$BACKEND_TEST_LOG"
cat > /dev/null
[[ "${FAIL_SSH:-false}" = false ]]
MOCK
chmod +x "$fixture/bin/git" "$fixture/bin/ssh"
: > "$BACKEND_TEST_LOG"
bash "$fixture/runner/.cnb/deploy-backend.sh"
grep -q 'StrictHostKeyChecking=yes' "$BACKEND_TEST_LOG"
grep -q -- '-p 2222' "$BACKEND_TEST_LOG"
grep -q '/srv/ycoj-v3' "$BACKEND_TEST_LOG"
grep -q "$target" "$BACKEND_TEST_LOG"
echo 'PASS: backend uses strict SSH verification, exact SHA and default server settings'

: > "$BACKEND_TEST_LOG"
export REMOTE_SHA=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
bash "$fixture/runner/.cnb/deploy-backend.sh"
[[ ! -s "$BACKEND_TEST_LOG" ]]
echo 'PASS: outdated runner cannot update the backend'

export REMOTE_SHA="$target" FAIL_SSH=true
if bash "$fixture/runner/.cnb/deploy-backend.sh"; then echo 'Expected SSH failure' >&2; exit 1; fi
echo 'PASS: SSH failures propagate to the pipeline'
