#!/usr/bin/env bash
set -Eeuo pipefail

repository=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repository"

: "${DEPLOY_HOST:?Set DEPLOY_HOST}"
: "${DEPLOY_USER:?Set DEPLOY_USER}"
: "${DEPLOY_SSH_KEY:?Set DEPLOY_SSH_KEY}"
: "${DEPLOY_KNOWN_HOSTS:?Set DEPLOY_KNOWN_HOSTS}"
deploy_root=${DEPLOY_ROOT:-/srv/ycoj-ui}
deploy_port=${DEPLOY_PORT:-22}
activate=${DEPLOY_ACTIVATE:-true}

[[ "$DEPLOY_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]]
[[ "$DEPLOY_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]]
[[ "$deploy_port" =~ ^[0-9]+$ && "$deploy_port" -ge 1 && "$deploy_port" -le 65535 ]]
[[ "$deploy_root" =~ ^/([a-zA-Z0-9_-]+/)*[a-zA-Z0-9_-]+$ ]]
[[ "$activate" = true || "$activate" = false ]]

# Recheck under the CNB deployment lock so an older build cannot overwrite a
# newer master that finished building first. Fail closed on network errors.
head=$(git rev-parse HEAD)
remote_head=$(git ls-remote --exit-code origin refs/heads/master)
if [[ "${remote_head%%[[:space:]]*}" != "$head" ]]; then
  echo 'Skipping deployment: master has advanced.'
  exit 0
fi

release_id=$(cat .build/ui-release-id)
[[ "$release_id" =~ ^[a-f0-9]{40}-[0-9]{14}-[0-9]+$ ]]
[[ "$release_id" = "$head"-* ]]
(cd .build && sha256sum --check ui-release.tar.gz.sha256)

credentials=$(mktemp -d)
trap 'rm -rf -- "$credentials"' EXIT
chmod 700 "$credentials"
printf '%s\n' "$DEPLOY_SSH_KEY" > "$credentials/id"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$credentials/known_hosts"
chmod 600 "$credentials/id" "$credentials/known_hosts"
unset DEPLOY_SSH_KEY DEPLOY_KNOWN_HOSTS

options=(-i "$credentials/id" -o IdentitiesOnly=yes -o BatchMode=yes
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$credentials/known_hosts"
  -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=4)
target="$DEPLOY_USER@$DEPLOY_HOST"
incoming="$deploy_root/incoming/$release_id"
release="$deploy_root/releases/$release_id"

ssh "${options[@]}" -p "$deploy_port" "$target" \
  "set -eu; umask 077; mkdir -p '$incoming' '$deploy_root/releases'; test ! -e '$release'"
scp "${options[@]}" -P "$deploy_port" \
  .build/ui-release.tar.gz .build/ui-release.tar.gz.sha256 "$target:$incoming/"
ssh "${options[@]}" -p "$deploy_port" "$target" \
  "set -eu; cd '$incoming'; sha256sum --check ui-release.tar.gz.sha256; mkdir '$release'; tar -xzf ui-release.tar.gz -C '$release'"

printf -v command 'bash %q %q %q' "$release/activate-ui.sh" "$deploy_root" "$release_id"
if [[ "$activate" = false ]]; then
  echo "Uploaded release. Run as the PM2 owner to activate: $command"
  exit 0
fi

# A login shell also loads Node/PM2 installed through nvm on the server.
printf -v login_command 'bash -lc %q' "$command"
ssh "${options[@]}" -p "$deploy_port" "$target" "$login_command"
