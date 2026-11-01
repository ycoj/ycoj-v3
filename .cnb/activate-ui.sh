#!/usr/bin/env bash
set -Eeuo pipefail

deploy_root=${1:?Usage: activate-ui.sh DEPLOY_ROOT RELEASE_ID}
release_id=${2:?Usage: activate-ui.sh DEPLOY_ROOT RELEASE_ID}
[[ "$deploy_root" =~ ^/([a-zA-Z0-9_-]+/)*[a-zA-Z0-9_-]+$ ]]
[[ "$release_id" =~ ^[a-f0-9]{40}-[0-9]{14}-[0-9]+$ ]]
release="$deploy_root/releases/$release_id"
test -f "$release/server.js"
test -f "$release/ecosystem.config.cjs"
test -f "$deploy_root/shared/runtime.env"
[[ "$(uname -m)" = x86_64 ]]
for command in node pm2 curl flock; do command -v "$command" > /dev/null; done
node -e 'if (Number(process.versions.node.split(".")[0]) !== 22) process.exit(1)'

exec 9> "$deploy_root/deploy.lock"
flock -w 120 9

previous=''
if [[ -L "$deploy_root/current" ]]; then
  previous=$(readlink -f "$deploy_root/current")
  test -f "$previous/ecosystem.config.cjs"
elif [[ -e "$deploy_root/current" ]]; then
  echo 'current must be a symlink.' >&2
  exit 1
elif pm2 describe ycoj-ui > /dev/null 2>&1; then
  echo 'First migration: stop/delete the source-based ycoj-ui process before activating. See docs/cnb-deployment.md.' >&2
  exit 1
fi

port=$(node -e 'console.log(require(process.argv[1]).apps[0].env.PORT)' "$release/ecosystem.config.cjs")
[[ "$port" =~ ^[0-9]+$ && "$port" -ge 1 && "$port" -le 65535 ]]

switch_current() {
  ln -s "$1" "$deploy_root/.current-$$"
  mv -Tf "$deploy_root/.current-$$" "$deploy_root/current"
}

start_release() {
  # PM2 restart can retain pm_exec_path/pm_cwd from the existing process even
  # when the ecosystem's script/cwd point to a different release directory.
  if pm2 describe ycoj-ui > /dev/null 2>&1; then
    pm2 delete ycoj-ui || return
  fi
  pm2 start "$1/ecosystem.config.cjs" --only ycoj-ui --update-env
}

rollback() {
  status=${1:-$?}
  trap - ERR HUP INT TERM
  set +e
  echo 'Activation failed; restoring the previous release.' >&2
  if [[ -n "$previous" ]]; then
    switch_current "$previous"
    start_release "$previous" || true
    pm2 save || true
  else
    pm2 delete ycoj-ui || true
    rm -f "$deploy_root/current"
    echo 'No previous artifact release exists. Restore the original source PM2 command if needed.' >&2
  fi
  exit "$status"
}

trap rollback ERR
trap 'rollback 1' HUP INT TERM
switch_current "$release"
start_release "$release"

# A release-specific URL proves PM2 is serving this build, rather than an old
# process still answering on the same port. Bypass outbound proxy variables.
healthy=false
for ((attempt = 0; attempt < 30; attempt++)); do
  if body=$(curl --noproxy '*' --fail --silent --show-error --max-time 3 \
    "http://127.0.0.1:$port/_next/static/deployments/$release_id.txt") && \
    [[ "$body" = "$release_id" ]]; then
    healthy=true
    break
  fi
  sleep 2
done
[[ "$healthy" = true ]]
pm2 save
trap - ERR HUP INT TERM
echo "Activated UI release $release_id"
