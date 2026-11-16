#!/usr/bin/env bash
set -Eeuo pipefail

source_root=${1:?Usage: update-backend.sh SOURCE_ROOT COMMIT PM2_NAME HEALTH_URL}
commit=${2:?Set commit}
process_name=${3:?Set PM2 name}
health_url=${4:?Set backend health URL}
[[ "$source_root" =~ ^/([a-zA-Z0-9_-]+/)*[a-zA-Z0-9_-]+$ ]]
[[ "$commit" =~ ^[a-f0-9]{40}$ ]]
[[ "$process_name" =~ ^[a-zA-Z][a-zA-Z0-9_-]*$ && "$process_name" != all ]]
[[ "$health_url" = http://* || "$health_url" = https://* ]]
for command in git yarn node pm2 curl flock; do
  command -v "$command" > /dev/null || { echo "Missing server command: $command" >&2; exit 1; }
done
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 19)) process.exit(1)'

cd "$source_root"
test "$(cd "$(git rev-parse --show-toplevel)" && pwd -P)" = "$(pwd -P)"
exec 9> "$(git rev-parse --git-path ycoj-deploy.lock)"
flock -w 1200 9
if [[ "$(git symbolic-ref --short HEAD)" != master ]]; then
  echo 'Backend source must be on the master branch.' >&2
  exit 1
fi
pm2 describe "$process_name" > /dev/null

retry() {
  local attempt
  for attempt in 1 2 3 4 5; do
    if "$@"; then return 0; fi
    if [[ "$attempt" = 5 ]]; then return 1; fi
    sleep "$((attempt * 10))"
  done
}

# Keep the existing origin and its server-side credentials. Deploy only the
# triggering revision, even if origin/master advances while this job runs.
GIT_TERMINAL_PROMPT=0 retry git fetch origin master
git cat-file -e "$commit^{commit}"
git merge-base --is-ancestor "$commit" FETCH_HEAD
git merge-base --is-ancestor HEAD "$commit"

# Corepack may add a Yarn packageManager pin and reformat the root manifest.
# Both the index and worktree must otherwise match HEAD or the release exactly.
package_manifest_base() {
  node - "$commit" <<'NODE'
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');
const readRevision = ref => JSON.parse(execFileSync('git', ['show', `${ref}:package.json`], { encoding: 'utf8' }));
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const matches = (manifest, baseline) => {
  if (!isObject(manifest) || !isObject(baseline)) return false;
  const normalized = { ...manifest };
  if (!Object.hasOwn(baseline, 'packageManager') && typeof normalized.packageManager === 'string'
      && /^yarn@\d+\.\d+\.\d+(?:\+sha(?:224|256|384|512)\.[a-f0-9]+)?$/.test(normalized.packageManager)) {
    delete normalized.packageManager;
  }
  return isDeepStrictEqual(normalized, baseline);
};
try {
  const baselines = ['HEAD', process.argv[2]].map(ref => [ref, readRevision(ref)]);
  const index = JSON.parse(execFileSync('git', ['show', ':package.json'], { encoding: 'utf8' }));
  const worktree = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const baseline = baselines.find(([, manifest]) => matches(worktree, manifest));
  if (!baseline || !baselines.some(([, manifest]) => matches(index, manifest))) process.exit(1);
  process.stdout.write(baseline[0]);
} catch {
  process.exit(1);
}
NODE
}

# Local production fixes can become tracked upstream. Only stage files whose
# current contents already match the target commit; never discard local edits.
matching=()
manifest_base=
while IFS= read -r -d '' path; do
  if ! git diff --quiet "$commit" -- "$path"; then
    if [[ "$path" = package.json && -f "$path" && ! -L "$path" ]] &&
      manifest_base=$(package_manifest_base); then
      continue
    fi
    echo "Backend has local changes not included in this release: $path" >&2
    printf 'Inspect server changes with: git diff HEAD -- %q\n' "$path" >&2
    exit 1
  fi
  matching+=("$path")
done < <(git diff --name-only -z HEAD)
while IFS= read -r -d '' path; do
  if ! expected=$(git rev-parse --verify "$commit:$path" 2>/dev/null); then continue; fi
  if [[ ! -f "$path" || -L "$path" ]] || \
    [[ "$(git hash-object --path="$path" -- "$path")" != "$expected" ]]; then
    echo "Untracked server file conflicts with this release: $path" >&2
    exit 1
  fi
  matching+=("$path")
done < <(git ls-files --others --exclude-standard -z)
if [[ -n "$manifest_base" ]]; then
  backup_root=$(git rev-parse --git-path ycoj-deploy-backups)
  backup=$(umask 077; mkdir -p -- "$backup_root"; mktemp -d "$backup_root/package-json-XXXXXXXX")
  (
    umask 077
    cp -- package.json "$backup/package.json"
    git show :package.json > "$backup/package.json.index"
  )
  git restore --source="$manifest_base" --staged --worktree -- package.json
  if [[ "$manifest_base" = "$commit" ]]; then matching+=(package.json); fi
  echo "Normalized generated package.json changes; original worktree and index saved in $backup."
fi
if [[ "${#matching[@]}" -gt 0 ]]; then
  git --literal-pathspecs add -- "${matching[@]}"
  git --literal-pathspecs diff --cached --quiet "$commit" -- "${matching[@]}"
  echo 'Preserving server changes already included in this release.'
fi
git merge --ff-only "$commit"
test "$(git rev-parse HEAD)" = "$commit"

echo "Installing backend dependencies for $commit (legacy UI build skipped)."
# This repository intentionally does not track a root yarn.lock.
COREPACK_ENABLE_AUTO_PIN=0 YARN_ENABLE_IMMUTABLE_INSTALLS=false yarn install
node -r @hydrooj/register -e 'require.resolve("hydrooj")'
pm2 restart "$process_name"

healthy=false
for ((attempt = 0; attempt < 30; attempt++)); do
  if pm2 jlist | node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      const processes = JSON.parse(input).filter(p => p.name === process.argv[1]);
      process.exit(processes.length > 0 && processes.every(p => p.pm2_env.status === "online") ? 0 : 1);
    });
  ' "$process_name" && curl --noproxy '*' --fail --silent --show-error --max-time 3 \
    "$health_url" > /dev/null; then
    healthy=true
    break
  fi
  sleep 2
done
if [[ "$healthy" != true ]]; then
  echo 'Backend health check failed. Inspect PM2 logs; source deployment requires manual recovery.' >&2
  exit 1
fi
pm2 save
echo "Deployed backend $commit; PM2 process $process_name is online."
