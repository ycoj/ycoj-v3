#!/usr/bin/env bash
set -Eeuo pipefail

repository=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
fixture=$(mktemp -d /tmp/ycoj-checkout-XXXXXX)
trap 'rm -rf -- "$fixture"' EXIT
mkdir -p "$fixture/bin"
export PATH="$fixture/bin:$PATH"
export CNB_COMMIT=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
export CHECKOUT_LOG="$fixture/commands.log"

node - "$repository" > "$fixture/checkout.sh" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const repo = process.argv[2];
const yaml = require(path.join(repo, 'ycoj-ui/node_modules/js-yaml'));
const config = yaml.load(fs.readFileSync(path.join(repo, '.cnb.yml'), 'utf8'));
process.stdout.write(config.master.push[0].stages.find(stage => stage.name === 'Verify source checkout').script);
NODE

cat > "$fixture/bin/git" <<'MOCK'
#!/usr/bin/env bash
set -eu
echo "$*" >> "$CHECKOUT_LOG"
case "$1" in
  cat-file) test -f "$CNB_BUILD_WORKSPACE/object" ;;
  fetch)
    count_file="$CNB_BUILD_WORKSPACE/fetch-count"
    count=$(cat "$count_file" 2>/dev/null || echo 0)
    echo "$((count + 1))" > "$count_file"
    if [[ "$count" -lt "${FAIL_FETCH_COUNT:-0}" ]]; then
      echo 'remote: Too Many Requests' >&2
      exit 1
    fi
    [[ "${!#}" = "$CNB_COMMIT" ]]
    touch "$CNB_BUILD_WORKSPACE/object"
    ;;
  checkout)
    [[ "${GIT_LFS_SKIP_SMUDGE:-}" = 1 && "${!#}" = "$CNB_COMMIT" ]]
    mkdir -p "$CNB_BUILD_WORKSPACE/ycoj-ui"
    touch "$CNB_BUILD_WORKSPACE/ycoj-ui/package.json"
    ;;
  lfs)
    if [[ "$2" = pull ]]; then
      count_file="$CNB_BUILD_WORKSPACE/lfs-count"
      count=$(cat "$count_file" 2>/dev/null || echo 0)
      echo "$((count + 1))" > "$count_file"
      [[ "$count" -ge "${FAIL_LFS_COUNT:-0}" ]]
    fi
    ;;
  *) exit 1 ;;
esac
MOCK
cat > "$fixture/bin/sleep" <<'MOCK'
#!/usr/bin/env bash
echo "sleep $*" >> "$CHECKOUT_LOG"
MOCK
chmod +x "$fixture/bin/"*

setup() {
  export CNB_BUILD_WORKSPACE="$fixture/$1"
  mkdir -p "$CNB_BUILD_WORKSPACE"
  : > "$CHECKOUT_LOG"
  unset FAIL_FETCH_COUNT FAIL_LFS_COUNT
}

setup empty-checkout
export FAIL_FETCH_COUNT=2 FAIL_LFS_COUNT=1
(cd / && sh "$fixture/checkout.sh")
[[ "$(cat "$CNB_BUILD_WORKSPACE/fetch-count")" = 3 ]]
[[ "$(cat "$CNB_BUILD_WORKSPACE/lfs-count")" = 2 ]]
test -f "$CNB_BUILD_WORKSPACE/ycoj-ui/package.json"
grep -qx 'sleep 20' "$CHECKOUT_LOG"
echo 'PASS: empty checkout recovers the triggering commit and retries LFS independently'

setup cached-checkout
touch "$CNB_BUILD_WORKSPACE/object"
(cd / && sh "$fixture/checkout.sh")
[[ ! -f "$CNB_BUILD_WORKSPACE/fetch-count" ]]
[[ "$(cat "$CNB_BUILD_WORKSPACE/lfs-count")" = 1 ]]
echo 'PASS: existing commit avoids an unnecessary fetch and uses the explicit workspace'

setup exhausted-retries
export FAIL_FETCH_COUNT=5
if sh "$fixture/checkout.sh"; then echo 'Expected checkout failure' >&2; exit 1; fi
[[ "$(cat "$CNB_BUILD_WORKSPACE/fetch-count")" = 5 ]]
[[ ! -f "$CNB_BUILD_WORKSPACE/ycoj-ui/package.json" ]]
[[ ! -f "$CNB_BUILD_WORKSPACE/lfs-count" ]]
echo 'PASS: persistent download failure stops before build or LFS processing'
