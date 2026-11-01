#!/usr/bin/env bash
set -Eeuo pipefail

repository=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
fixture=$(mktemp -d /tmp/ycoj-deploy-XXXXXX)
trap 'rm -rf -- "$fixture"' EXIT
mkdir -p "$fixture/bin"
export PATH="$fixture/bin:$PATH"
export PM2_LOG="$fixture/pm2.log"
export PM2_STATE="$fixture/pm2.state"
old_id=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-20261101000000-1
new_id=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-20261101000000-2

cat > "$fixture/bin/pm2" <<'MOCK'
#!/usr/bin/env bash
set -eu
echo "$*" >> "$PM2_LOG"
case "$1" in
  describe) test -f "$PM2_STATE" ;;
  startOrRestart)
    # Model PM2 retaining the old executable/cwd when restarting by name.
    if [[ ! -f "$PM2_STATE" ]]; then printf '%s\n' "$2" > "$PM2_STATE"; fi
    ;;
  start)
    [[ ! -f "$PM2_STATE" ]]
    [[ -z "${FAIL_RELEASE:-}" || "$2" != *"$FAIL_RELEASE"* ]]
    printf '%s\n' "$2" > "$PM2_STATE"
    ;;
  delete) rm -f "$PM2_STATE" ;;
  save) ;;
  *) exit 1 ;;
esac
MOCK
cat > "$fixture/bin/curl" <<'MOCK'
#!/usr/bin/env bash
set -eu
[[ "${FAIL_HEALTH:-false}" = false ]]
url=${!#}
release_id=${url##*/}
release_id=${release_id%.txt}
[[ "$(cat "$PM2_STATE")" = *"$release_id"* ]]
echo "$release_id"
MOCK
for command in flock sleep; do
  printf '#!/usr/bin/env bash\nexit 0\n' > "$fixture/bin/$command"
done
chmod +x "$fixture/bin/"*

setup() {
  export deploy_root="$fixture/$1"
  mkdir -p "$deploy_root/shared"
  printf 'PORT=3000\nBACKEND_BASEURL=http://127.0.0.1:2333\n' > "$deploy_root/shared/runtime.env"
  for id in "$old_id" "$new_id"; do
    mkdir -p "$deploy_root/releases/$id"
    touch "$deploy_root/releases/$id/server.js"
    cp "$repository/.cnb/ecosystem.config.cjs" "$deploy_root/releases/$id/"
  done
  rm -f "$PM2_STATE"
  : > "$PM2_LOG"
  unset FAIL_RELEASE FAIL_HEALTH
}

activate() {
  bash "$repository/.cnb/activate-ui.sh" "$deploy_root" "$new_id"
}

setup first-release
activate
[[ "$(readlink "$deploy_root/current")" = "$deploy_root/releases/$new_id" ]]
grep -F "start $deploy_root/releases/$new_id/ecosystem.config.cjs" "$PM2_LOG"
grep -x save "$PM2_LOG"
echo 'PASS: first artifact deployment starts and persists PM2'

setup update-release
ln -s "$deploy_root/releases/$old_id" "$deploy_root/current"
echo "$deploy_root/releases/$old_id/ecosystem.config.cjs" > "$PM2_STATE"
activate
[[ "$(readlink "$deploy_root/current")" = "$deploy_root/releases/$new_id" ]]
[[ "$(cat "$PM2_STATE")" = "$deploy_root/releases/$new_id/ecosystem.config.cjs" ]]
grep -qx 'delete ycoj-ui' "$PM2_LOG"
echo 'PASS: subsequent deployment updates the PM2 script and current release'

setup existing-source
echo source > "$PM2_STATE"
if activate; then echo 'Expected source migration guard to fail' >&2; exit 1; fi
[[ ! -e "$deploy_root/current" ]]
[[ "$(cat "$PM2_STATE")" = source ]]
echo 'PASS: existing source process is preserved before manual migration'

for failure in restart health; do
  setup "rollback-$failure"
  ln -s "$deploy_root/releases/$old_id" "$deploy_root/current"
  echo "$deploy_root/releases/$old_id/ecosystem.config.cjs" > "$PM2_STATE"
  if [[ "$failure" = restart ]]; then
    export FAIL_RELEASE="$new_id"
  else
    export FAIL_HEALTH=true
  fi
  if activate; then echo "Expected $failure failure" >&2; exit 1; fi
  [[ "$(readlink "$deploy_root/current")" = "$deploy_root/releases/$old_id" ]]
  [[ "$(cat "$PM2_STATE")" = "$deploy_root/releases/$old_id/ecosystem.config.cjs" ]]
  grep -x save "$PM2_LOG"
  echo "PASS: $failure failure restores the previous release and PM2 command"
done

setup first-release-failure
export FAIL_HEALTH=true
if activate; then echo 'Expected first release failure' >&2; exit 1; fi
[[ ! -e "$deploy_root/current" ]]
[[ ! -f "$PM2_STATE" ]]
echo 'PASS: unsuccessful first deployment removes the failed process'

setup missing-config
rm "$deploy_root/shared/runtime.env"
if activate; then echo 'Expected missing runtime configuration to fail' >&2; exit 1; fi
[[ ! -s "$PM2_LOG" ]]
echo 'PASS: incomplete server preparation does not change PM2'
