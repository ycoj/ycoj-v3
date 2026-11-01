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
git -C "$fixture/upstream" add source.txt
git -C "$fixture/upstream" commit -qm initial
base=$(git -C "$fixture/upstream" rev-parse HEAD)
echo next > "$fixture/upstream/source.txt"
git -C "$fixture/upstream" commit -qam next
target=$(git -C "$fixture/upstream" rev-parse HEAD)
echo future > "$fixture/upstream/source.txt"
git -C "$fixture/upstream" commit -qam future

cat > "$fixture/bin/yarn" <<'MOCK'
#!/usr/bin/env bash
echo "yarn $*" >> "$BACKEND_TEST_LOG"
[[ "$*" = install && "${YARN_ENABLE_IMMUTABLE_INSTALLS:-}" = false ]]
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

setup success
echo keep > "$server/config.yaml"
deploy
[[ "$(git -C "$server" rev-parse HEAD)" = "$target" ]]
[[ "$(cat "$server/config.yaml")" = keep ]]
grep -qx 'pm2 restart ycoj' "$BACKEND_TEST_LOG"
grep -qx 'pm2 save' "$BACKEND_TEST_LOG"
[[ "$(grep -c '^yarn ' "$BACKEND_TEST_LOG")" = 1 ]]
echo 'PASS: exact triggering commit is deployed, config preserved, only ycoj restarts, no UI build'

setup dirty
echo local > "$server/source.txt"
if deploy; then echo 'Expected dirty tree rejection' >&2; exit 1; fi
[[ "$(cat "$server/source.txt")" = local ]]
[[ ! -s "$BACKEND_TEST_LOG" || "$(cat "$BACKEND_TEST_LOG")" = flock ]]
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
